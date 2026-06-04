import { Suspense, useMemo, useCallback, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import {
  parseCubeKey,
  cubeToKey,
  getAllEdges,
  edgeKey,
  tileToWorld3D,
  nodeToWorld3D,
  TILE_NODE_MAP,
} from '@/entities/board/coordinates';
import HexTile3D from './HexTile3D';
import RoadEdge3D from './RoadEdge3D';
import VertexNode3D from './VertexNode3D';
import Port3D from './Port3D';
import type { PlayableAction, PlayerColor } from '@/shared/types/game';

interface GameBoard3DProps {
  onAction?: (_: PlayableAction) => void;
  disabled?: boolean;
  sidebarWidth?: number;
}

// ── Ocean plane ────────────────────────────────────────────────────────────────
function Ocean() {
  const texture = useTexture('/assets/tiles/water_background.png');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

// ── Beach border ──────────────────────────────────────────────────────────────
// Traces the outer boundary of the 19 tiles (edges shared by exactly one tile)
// to get the exact 30-vertex perimeter polygon. Builds a custom ring BufferGeometry
// between that polygon and a radially-expanded copy of it. A `t` vertex attribute
// (0 = inner edge, 1 = outer edge) drives the fade so the border follows the exact
// tile shapes and blends narrowly into the ocean.

// Computed once at module load — no DOM/WebGL required, pure math.
const OUTER_BOARD_BOUNDARY: THREE.Vector2[] = (() => {
  const edgeCount = new Map<string, number>();
  const edgeNodeMap = new Map<string, [number, number]>();
  for (const nodes of TILE_NODE_MAP.values()) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const b = nodes[(i + 1) % nodes.length];
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      if (!edgeNodeMap.has(key)) edgeNodeMap.set(key, [a, b]);
    }
  }
  const adj = new Map<number, number[]>();
  for (const [key, count] of edgeCount) {
    if (count === 1) {
      const [a, b] = edgeNodeMap.get(key)!;
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    }
  }
  const startNode = [...adj.keys()][0];
  const polygon: number[] = [startNode];
  let prev = -1, curr = startNode;
  while (true) {
    const next = adj.get(curr)!.find(n => n !== prev)!;
    if (next === startNode) break;
    polygon.push(next);
    prev = curr;
    curr = next;
  }
  return polygon.map(id => {
    const [wx, , wz] = nodeToWorld3D(id);
    return new THREE.Vector2(wx, wz);
  });
})();

const BEACH_RING_VERT = /* glsl */`
  attribute float t;
  varying vec3 vWorldPos;
  varying float vT;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vT = t;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BEACH_RING_FRAG = /* glsl */`
  uniform sampler2D map;
  varying vec3 vWorldPos;
  varying float vT;
  void main() {
    vec2 uv = vWorldPos.xz * 0.18;
    vec4 col = texture2D(map, uv);
    float alpha = 1.0 - smoothstep(0.4, 1.0, vT);
    gl_FragColor = vec4(col.rgb, alpha);
  }
`;

function BeachBorder() {
  const texture = useTexture('/assets/tiles/beach.jpg');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const geometry = useMemo(() => {
    const inner = OUTER_BOARD_BOUNDARY;
    const n = inner.length;
    // Width of the visible beach strip in world units
    const BORDER_WIDTH = 1.0;

    // Expand each vertex radially outward from center by BORDER_WIDTH
    const outer = inner.map(p => {
      const len = Math.sqrt(p.x * p.x + p.y * p.y);
      if (len < 0.001) return p.clone();
      return new THREE.Vector2(
        p.x + (p.x / len) * BORDER_WIDTH,
        p.y + (p.y / len) * BORDER_WIDTH,
      );
    });

    const positions: number[] = [];
    const tValues: number[] = [];

    // Inner ring vertices at t=0 (fully opaque), outer at t=1 (fades out)
    for (const p of inner) { positions.push(p.x, 0, p.y); tValues.push(0); }
    for (const p of outer) { positions.push(p.x, 0, p.y); tValues.push(1); }

    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(i, i + n, j + n);
      indices.push(i, j + n, j);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('t', new THREE.Float32BufferAttribute(tValues, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { map: { value: texture } },
    vertexShader: BEACH_RING_VERT,
    fragmentShader: BEACH_RING_FRAG,
  }), [texture]);

  // No rotation needed — geometry is already in world XZ at Y=0,
  // positioned just below tiles (Y=0) and above ocean (Y=-0.12).
  return <mesh geometry={geometry} material={material} position={[0, -0.07, 0]} />;
}

// ── Sidebar-aware camera ───────────────────────────────────────────────────────
// Shifts the projection so the board appears centred in the left zone even
// though the canvas now fills the full screen (including behind the sidebar).
// setViewOffset tells Three.js to render a sub-region of a wider virtual
// frustum: world-origin ends up at pixel (W - sidebarWidth) / 2 on screen.
function SidebarAwareCamera({ sidebarWidth }: { sidebarWidth: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.setViewOffset(
      size.width + sidebarWidth, size.height,
      sidebarWidth, 0,
      size.width, size.height,
    );
    cam.updateProjectionMatrix();
    return () => { cam.clearViewOffset(); cam.updateProjectionMatrix(); };
  }, [camera, size.width, size.height, sidebarWidth]);
  return null;
}

// ── Board scene ────────────────────────────────────────────────────────────────
interface BoardSceneProps {
  onAction?: (_: PlayableAction) => void;
  disabled?: boolean;
  sidebarWidth?: number;
}

// Clamps the OrbitControls target so panning can't go further than the board edge
// ── Analysis overlay ──────────────────────────────────────────────────────────
// Parses action_taken / best_action from replayAnalysis and renders pulsing
// torus rings at the corresponding board positions.

function parseActionPos(
  actionType: string,
  value: unknown,
): [number, number, number] | null {
  if (actionType === 'BUILD_SETTLEMENT' || actionType === 'BUILD_CITY') {
    if (typeof value === 'number') return nodeToWorld3D(value);
  }
  if (actionType === 'BUILD_ROAD') {
    if (Array.isArray(value) && value.length >= 2) {
      const [ax, ay, az] = nodeToWorld3D(value[0] as number);
      const [bx, by, bz] = nodeToWorld3D(value[1] as number);
      return [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2];
    }
  }
  if (actionType === 'MOVE_ROBBER') {
    if (Array.isArray(value) && Array.isArray(value[0])) {
      const [cx, , cz] = value[0] as [number, number, number];
      return tileToWorld3D(cx, cz);
    }
    if (Array.isArray(value) && typeof value[0] === 'number') {
      const [cx, , cz] = value as [number, number, number];
      return tileToWorld3D(cx, cz);
    }
  }
  return null;
}

function PulsingRing({
  position,
  color,
  phase: phaseOffset,
}: {
  position: [number, number, number];
  color: string;
  phase: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime * 2.2 + phaseOffset;
    const pulse = 0.55 + 0.45 * Math.sin(t);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.5 + 0.7 * pulse;
    meshRef.current.scale.setScalar(0.94 + 0.08 * pulse);
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1] + 0.06, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[0.40, 0.055, 8, 32]} />
      <meshStandardMaterial
        color={threeColor}
        emissive={threeColor}
        emissiveIntensity={0.8}
        roughness={0.4}
        metalness={0.05}
        transparent
        opacity={0.58}
      />
    </mesh>
  );
}

function AnalysisOverlay() {
  const analysis  = useGameStore(s => s.replayAnalysis);
  const isReplay  = useGameStore(s => s.replayMode);
  const loading   = useGameStore(s => s.replayAnalysisLoading);

  if (!isReplay || loading || !analysis) return null;

  const takenPos = analysis.action_taken
    ? parseActionPos(analysis.action_taken.action_type, analysis.action_taken.value)
    : null;

  const bestPos = analysis.best_action
    ? parseActionPos(analysis.best_action.action_type, analysis.best_action.value)
    : null;

  const sameSpot =
    takenPos && bestPos &&
    Math.abs(takenPos[0] - bestPos[0]) < 0.1 &&
    Math.abs(takenPos[2] - bestPos[2]) < 0.1;

  return (
    <>
      {takenPos && (
        <PulsingRing
          position={takenPos}
          color="#f0a93a"
          phase={0}
        />
      )}
      {bestPos && !sameSpot && (
        <PulsingRing
          position={bestPos}
          color="#4f8dff"
          phase={Math.PI}
        />
      )}
    </>
  );
}

function PanClamp({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const t = ctrl.target;
    const LIMIT = 6;
    const cx = Math.max(-LIMIT, Math.min(LIMIT, t.x));
    const cz = Math.max(-LIMIT, Math.min(LIMIT, t.z));
    if (cx !== t.x || cz !== t.z || t.y !== 0) {
      // Compute the pullback delta and apply it to BOTH target and camera.
      // This keeps the camera→target offset vector identical, so the viewing
      // angle never changes at the boundary. No ctrl.update() needed — that
      // would re-derive camera from OrbitControls' internal spherical state
      // (relative to the pre-clamp target) and produce the angle jump.
      const dx = cx - t.x;
      const dz = cz - t.z;
      const dy = -t.y;
      t.x = cx; t.z = cz; t.y = 0;
      ctrl.object.position.x += dx;
      ctrl.object.position.y += dy;
      ctrl.object.position.z += dz;
    }
  });
  return null;
}

function BoardScene({ onAction, disabled, sidebarWidth = 372 }: BoardSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const gameState = useGameStore(s => s.gameState);
  const replayMode = useGameStore(s => s.replayMode);
  const replayFrames = useGameStore(s => s.replayFrames);
  const replayStep = useGameStore(s => s.replayStep);

  const hoveredNode = useInteractionStore(s => s.hoveredNode);
  const hoveredEdge = useInteractionStore(s => s.hoveredEdge);
  const setHoveredNode = useInteractionStore(s => s.setHoveredNode);
  const setHoveredEdge = useInteractionStore(s => s.setHoveredEdge);
  const setHoveredTile = useInteractionStore(s => s.setHoveredTile);
  const mode = useInteractionStore(s => s.mode);

  const textures = useTexture({
    WOOD:   '/assets/tiles/wood.png',
    BRICK:  '/assets/tiles/brick.png',
    SHEEP:  '/assets/tiles/sheep.png',
    WHEAT:  '/assets/tiles/hay.png',
    ORE:    '/assets/tiles/ore.png',
    DESERT: '/assets/tiles/desert.png',
  });
  // PNG/JPG files are sRGB-encoded; mark them so Three.js applies the correct
  // inverse-gamma before lighting instead of treating them as linear data.
  Object.values(textures).forEach(t => { t.colorSpace = THREE.SRGBColorSpace; });

  const displayState = useMemo(() => {
    if (replayMode && replayFrames.length > 0) {
      return replayFrames[replayStep]?.state ?? gameState;
    }
    return gameState;
  }, [replayMode, replayFrames, replayStep, gameState]);

  const board = displayState?.board;
  const playableActions = gameState?.playable_actions ?? [];

  const legalSettlementNodes = useMemo(() => {
    const set = new Set<number>();
    for (const a of playableActions) {
      if (a.action_type === 'BUILD_SETTLEMENT' && typeof a.value === 'number') set.add(a.value);
    }
    return set;
  }, [playableActions]);

  const legalCityNodes = useMemo(() => {
    const set = new Set<number>();
    for (const a of playableActions) {
      if (a.action_type === 'BUILD_CITY' && typeof a.value === 'number') set.add(a.value);
    }
    return set;
  }, [playableActions]);

  const legalRoadEdges = useMemo(() => {
    const set = new Set<string>();
    for (const a of playableActions) {
      if (a.action_type === 'BUILD_ROAD' && Array.isArray(a.value)) {
        const [a1, b1] = a.value as [number, number];
        set.add(edgeKey(a1, b1));
      }
    }
    return set;
  }, [playableActions]);

  const legalRobberTiles = useMemo(() => {
    const set = new Set<string>();
    for (const a of playableActions) {
      if (a.action_type === 'MOVE_ROBBER' && Array.isArray(a.value)) {
        const coord = a.value[0] as [number, number, number];
        if (Array.isArray(coord)) set.add(cubeToKey(coord[0], coord[1], coord[2]));
      }
    }
    return set;
  }, [playableActions]);

  const phase = gameState?.game_phase;
  const isInitialBuild = phase === 'INITIAL_BUILD';
  // Settlements: always show during initial placement (player must pick a spot and it's the
  // only thing they can do); during normal play only show when BUILD_SETTLEMENT mode is active.
  const showSettlementHighlights = !disabled && (
    mode === 'BUILD_SETTLEMENT' || (isInitialBuild && mode === 'IDLE')
  ) && legalSettlementNodes.size > 0;
  const showCityHighlights = !disabled && mode === 'BUILD_CITY' && legalCityNodes.size > 0;
  // Roads: during initial build mirror the settlement behaviour — auto-show in IDLE mode
  // so mobile/tablet users see legal edges without opening the action drawer.
  // During normal play, only show when BUILD_ROAD mode is explicitly active.
  const showRoadHighlights = !disabled && (
    mode === 'BUILD_ROAD' ||
    (isInitialBuild && mode === 'IDLE' && legalRoadEdges.size > 0)
  ) && legalRoadEdges.size > 0;
  const showRobberHighlights = !disabled && (mode === 'MOVE_ROBBER' || phase === 'MOVING_ROBBER') && legalRobberTiles.size > 0;

  const handleTileClick = useCallback((tileKey: string) => {
    if (disabled || !showRobberHighlights) return;
    const [x, y, z] = parseCubeKey(tileKey);
    const key = cubeToKey(x, y, z);
    if (!legalRobberTiles.has(key)) return;
    const action = playableActions.find(a => {
      if (a.action_type !== 'MOVE_ROBBER' || !Array.isArray(a.value)) return false;
      const coord = a.value[0] as [number, number, number];
      if (!Array.isArray(coord)) return false;
      return cubeToKey(coord[0], coord[1], coord[2]) === key;
    });
    if (action) onAction?.(action);
  }, [disabled, showRobberHighlights, legalRobberTiles, playableActions, onAction]);

  const handleNodeClick = useCallback((nodeId: number) => {
    if (disabled) return;
    if (legalSettlementNodes.has(nodeId)) {
      const action = playableActions.find(a => a.action_type === 'BUILD_SETTLEMENT' && a.value === nodeId);
      if (action) onAction?.(action);
      return;
    }
    if (legalCityNodes.has(nodeId)) {
      const action = playableActions.find(a => a.action_type === 'BUILD_CITY' && a.value === nodeId);
      if (action) onAction?.(action);
    }
  }, [disabled, legalSettlementNodes, legalCityNodes, playableActions, onAction]);

  const handleEdgeClick = useCallback((a: number, b: number) => {
    if (disabled) return;
    const key = edgeKey(a, b);
    if (!legalRoadEdges.has(key)) return;
    const action = playableActions.find(act => {
      if (act.action_type !== 'BUILD_ROAD' || !Array.isArray(act.value)) return false;
      const [va, vb] = act.value as [number, number];
      return edgeKey(va, vb) === key;
    });
    if (action) onAction?.(action);
  }, [disabled, legalRoadEdges, playableActions, onAction]);

  const allEdges = useMemo(() => getAllEdges(), []);

  if (!displayState || !board) return null;

  const robberKey = cubeToKey(
    displayState.board.robber_coordinate[0],
    displayState.board.robber_coordinate[1],
    displayState.board.robber_coordinate[2],
  );

  return (
    <>
      <SidebarAwareCamera sidebarWidth={sidebarWidth} />

      {/* Lighting — intensities tuned for sRGB-correct textures + NoToneMapping */}
      <ambientLight intensity={1.2} color="#c8deff" />
      <directionalLight
        position={[6, 12, 6]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <directionalLight position={[-6, 8, -4]} intensity={0.5} color="#ffd8a8" />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#8080ff" decay={2} />

      <OrbitControls
        ref={controlsRef}
        enableRotate={false}
        enablePan={true}
        screenSpacePanning={false}
        panSpeed={0.8}
        minDistance={5}
        maxDistance={24}
        mouseButtons={{ LEFT: 2, MIDDLE: 1, RIGHT: 2 }}
        touches={{ ONE: 1, TWO: 2 }}
        target={[0, 0, 0]}
      />
      <PanClamp controlsRef={controlsRef} />

      <Ocean />
      <BeachBorder />
      <AnalysisOverlay />

      {/* Hex tiles */}
      {Object.entries(board.tiles).map(([key, tile]) => {
        const [x, y, z] = parseCubeKey(key);
        const pos = tileToWorld3D(x, y);
        const isRobberHere = robberKey === cubeToKey(x, y, z);
        const isLegalRobber = showRobberHighlights && legalRobberTiles.has(cubeToKey(x, y, z));
        const resource = tile.resource ?? 'DESERT';
        const tex = textures[resource as keyof typeof textures] ?? null;

        return (
          <HexTile3D
            key={key}
            tile={tile}
            position={pos}
            texture={tex}
            hasRobber={isRobberHere}
            isLegalRobber={isLegalRobber}
            onClick={() => handleTileClick(key)}
            onPointerEnter={() => setHoveredTile(key)}
            onPointerLeave={() => setHoveredTile(null)}
          />
        );
      })}

      {/* Roads */}
      {allEdges.map(([a, b]) => {
        const key = edgeKey(a, b);
        const reverseKey = `(${a}, ${b})`;
        const reverseKey2 = `(${b}, ${a})`;
        const ownerColor = board.roads[reverseKey] ?? board.roads[reverseKey2] ?? null;
        const isLegalRoad = showRoadHighlights && legalRoadEdges.has(key);
        const isHov = hoveredEdge ? edgeKey(hoveredEdge[0], hoveredEdge[1]) === key : false;

        if (!ownerColor && !isLegalRoad) return null;

        const posA = nodeToWorld3D(a);
        const posB = nodeToWorld3D(b);

        return (
          <RoadEdge3D
            key={key}
            posA={posA}
            posB={posB}
            ownerColor={ownerColor as PlayerColor | null}
            isLegal={isLegalRoad}
            isHovered={isHov}
            onClick={() => handleEdgeClick(a, b)}
            onPointerEnter={() => setHoveredEdge([a, b])}
            onPointerLeave={() => setHoveredEdge(null)}
          />
        );
      })}

      {/* Ports */}
      {board.ports.map((port, i) => (
        <Port3D key={i} port={port} />
      ))}

      {/* Vertex nodes (settlements & cities) */}
      {Array.from({ length: 54 }, (_, nodeId) => {
        const building = board.buildings[String(nodeId)] ?? null;
        const isLegalS = showSettlementHighlights && legalSettlementNodes.has(nodeId);
        const isLegalC = showCityHighlights && legalCityNodes.has(nodeId);
        const isHov = hoveredNode === nodeId;
        const pos = nodeToWorld3D(nodeId);

        return (
          <VertexNode3D
            key={nodeId}
            position={pos}
            building={building}
            isLegalSettlement={isLegalS}
            isLegalCity={isLegalC}
            isHovered={isHov}
            onClick={() => handleNodeClick(nodeId)}
            onPointerEnter={() => setHoveredNode(nodeId)}
            onPointerLeave={() => setHoveredNode(null)}
          />
        );
      })}
    </>
  );
}

// ── Loading fallback ───────────────────────────────────────────────────────────
function BoardLoadingFallback() {
  return (
    <mesh>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#060e1c" />
    </mesh>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function GameBoard3D({ onAction, disabled, sidebarWidth = 372 }: GameBoard3DProps) {
  return (
    <div className="w-full h-full" style={{ touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, 14, 9], fov: 45, near: 0.1, far: 200 }}
        shadows
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
        dpr={[1, 2]}
      >
        <Suspense fallback={<BoardLoadingFallback />}>
          <BoardScene onAction={onAction} disabled={disabled} sidebarWidth={sidebarWidth} />
        </Suspense>
      </Canvas>
    </div>
  );
}
