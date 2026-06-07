import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

useGLTF.preload('/assets/models/road.glb');

const DROP_HEIGHT = 4.0;
const ANIM_SPEED = 1.6;

function springDrop(t: number): number {
  return 1 - Math.exp(-t * 8) * Math.cos(t * Math.PI * 2);
}

const ROAD_HEIGHT = 0.07;
const ROAD_WIDTH = 0.11;
// Total length trimmed across both ends so roads don't clip into vertex pieces or each other.
const ROAD_END_GAP = 0.42;

// Sketchfab Z-up→Y-up root transform: model-Z→worldY, model-Y→world(-Z).
// Road world-space bounds:
//   worldX=[1.314,5.314] cx=3.314 sizeX=4  (→ parent Z = road width after rotation)
//   worldY=[0,24]        cy=12              (→ parent X = edge length after rotation)
//   worldZ=[-5.519,-1.519] cz=-3.519 sizeZ=4 (→ parent Y = road height after rotation)
// Rotation [-PI/2, 0, -PI/2] (XYZ Euler) = R' maps (x,y,z)→(y,z,x):
//   worldY (long 24) → parentX (edge direction)
//   worldX           → parentZ (road width)
//   worldZ           → parentY (road height)
const R_CX = 3.314;
const R_CY = 12.0;
const R_CZ = -3.519;
const R_SX = ROAD_WIDTH / 4;    // 0.045 — worldX→parentZ
const R_SZ = ROAD_HEIGHT / 4;   // 0.0175 — worldZ→parentY

interface OwnedRoadModelProps {
  clonedRoad: THREE.Group;
  cPosX: number;
  cPosY: number;
  cPosZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

function OwnedRoadModel({ clonedRoad, cPosX, cPosY, cPosZ, scaleX, scaleY, scaleZ }: OwnedRoadModelProps) {
  const dropRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  useFrame((_, delta) => {
    if (!dropRef.current || tRef.current >= 1) return;
    tRef.current = Math.min(tRef.current + delta * ANIM_SPEED, 1);
    dropRef.current.position.y = DROP_HEIGHT * (1 - springDrop(tRef.current));
  });
  return (
    <group ref={dropRef} position={[0, DROP_HEIGHT, 0]}>
      <group rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <group position={[cPosX, cPosY, cPosZ]}>
          <group scale={[scaleX, scaleY, scaleZ]}>
            <primitive object={clonedRoad} />
          </group>
        </group>
      </group>
    </group>
  );
}

interface RoadEdge3DProps {
  posA: [number, number, number];
  posB: [number, number, number];
  ownerColor?: PlayerColor | null;
  isLegal?: boolean;
  isHovered?: boolean;
  isPreview?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

export default function RoadEdge3D({
  posA,
  posB,
  ownerColor,
  isLegal,
  isHovered,
  isPreview,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: RoadEdge3DProps) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const { scene } = useGLTF('/assets/models/road.glb') as { scene: THREE.Group };

  useFrame(({ clock }) => {
    if (!pulseRef.current || !isLegal || ownerColor) return;
    const t = clock.getElapsedTime();
    const mat = pulseRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.3 + Math.sin(t * 2.5) * 0.25;
  });

  const { midX, midY, midZ, length, angle } = useMemo(() => {
    const dx = posB[0] - posA[0];
    const dz = posB[2] - posA[2];
    return {
      midX: (posA[0] + posB[0]) / 2,
      midY: (posA[1] + posB[1]) / 2,
      midZ: (posA[2] + posB[2]) / 2,
      length: Math.sqrt(dx * dx + dz * dz),
      angle: -Math.atan2(dz, dx),
    };
  }, [posA, posB]);

  const clonedRoad = useMemo(() => {
    if (!ownerColor) return null;
    const cloned = scene.clone(true);
    const mat = new THREE.MeshStandardMaterial({
      color: PLAYER_COLORS[ownerColor],
      roughness: 0.65,
      metalness: 0.15,
    });
    cloned.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.material = mat;
        obj.castShadow = true;
      }
    });
    return cloned;
  }, [scene, ownerColor]);

  if (!ownerColor && !isLegal) return null;

  const isHoveredLegal = isHovered && isLegal && !ownerColor;
  const effectiveLength = length - ROAD_END_GAP;
  const scaleY = effectiveLength / 24; // worldY is the 24-unit long axis

  // Centering position (in rotation-group space, accounting for scale):
  // pos = [-R_SX*cx, -scaleY*cy, -R_SZ*cz]
  const cPosX = -R_SX * R_CX;    // -0.149 (constant)
  const cPosY = -scaleY * R_CY;  // -effectiveLength/2 (varies per edge)
  const cPosZ = -R_SZ * R_CZ;    //  0.062 (constant)

  return (
    <group
      position={[midX, midY + ROAD_HEIGHT / 2, midZ]}
      rotation={[0, angle, 0]}
      onClick={isLegal ? onClick : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Invisible hit area */}
      <mesh visible={false}>
        <boxGeometry args={[length, 0.1, 0.5]} />
        <meshBasicMaterial />
      </mesh>

      {ownerColor && clonedRoad ? (
        <OwnedRoadModel
          clonedRoad={clonedRoad}
          cPosX={cPosX}
          cPosY={cPosY}
          cPosZ={cPosZ}
          scaleX={R_SX}
          scaleY={scaleY}
          scaleZ={R_SZ}
        />
      ) : (
        /* Legal move indicator */
        <mesh ref={pulseRef} renderOrder={2}>
          <boxGeometry args={[effectiveLength, ROAD_HEIGHT * 0.7, ROAD_WIDTH * 0.9]} />
          <meshStandardMaterial
            color={isPreview ? (isHoveredLegal ? '#86efac' : '#4ade80') : (isHoveredLegal ? '#90caf9' : '#64b5f6')}
            emissive={isPreview ? '#16a34a' : '#3080c0'}
            emissiveIntensity={0.3}
            transparent
            opacity={isHoveredLegal ? 0.85 : 0.55}
            roughness={0.5}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}
