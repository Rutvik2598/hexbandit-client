import { useRef, useMemo } from 'react';
import { useTexture, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TileEntry } from '@/shared/types/game';
import { fitTextureToHex } from '@/shared/utils/textureUtils';

const TILE_RADIUS = 1.19;
const HEX_DEPTH = 0;
const BORDER_COLOR = '#f0f2f8';
const BORDER_RATIO = 0.90;
const INNER_RADIUS = TILE_RADIUS * BORDER_RATIO;
const INNER_TOP_Y = HEX_DEPTH / 2 + 0.002;

// 3D number token dimensions
const TOKEN_RADIUS = 0.27;
const TOKEN_H = 0.05;
const TOKEN_TOP_Y = INNER_TOP_Y + TOKEN_H;

const BEACH_CAP_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const BEACH_CAP_FRAG = /* glsl */`
  uniform sampler2D map;
  varying vec3 vWorldPos;
  void main() {
    vec2 uv = vWorldPos.xz * 0.18;
    gl_FragColor = texture2D(map, uv);
  }
`;

const NUMBER_DOTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

function NumberToken3D({ number }: { number: number }) {
  const isRed = number === 6 || number === 8;
  const dots = NUMBER_DOTS[number] || 0;
  const inkColor = isRed ? '#c41a1a' : '#2a1a08';

  return (
    <group>
      {/* Disc — sits on the tile surface */}
      <mesh position={[0, INNER_TOP_Y + TOKEN_H / 2, 0]} castShadow>
        <cylinderGeometry args={[TOKEN_RADIUS, TOKEN_RADIUS, TOKEN_H, 32]} />
        <meshStandardMaterial
          color="#f0d898"
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* Number — lying flat, offset toward the back so dots sit below it on screen */}
      <Text
        position={[0, TOKEN_TOP_Y + 0.003, -0.045]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color={inkColor}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {String(number)}
      </Text>

      {/* Probability dots — row below the number */}
      {dots > 0 && (
        <group position={[0, TOKEN_TOP_Y + 0.003, 0.07]} rotation={[-Math.PI / 2, 0, 0]}>
          {Array.from({ length: dots }).map((_, i) => (
            <mesh key={i} position={[(i - (dots - 1) / 2) * 0.065, 0, 0]}>
              <circleGeometry args={[0.022, 8]} />
              <meshBasicMaterial color={inkColor} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

interface HexTile3DProps {
  tile: TileEntry;
  position: [number, number, number];
  texture: THREE.Texture | null;
  hasRobber?: boolean;
  isLegalRobber?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

export default function HexTile3D({
  tile,
  position,
  texture,
  hasRobber,
  isLegalRobber,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: HexTile3DProps) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const beachTex = useTexture('/assets/tiles/beach.jpg');

  const beachMaterials = useMemo(() => {
    beachTex.wrapS = beachTex.wrapT = THREE.RepeatWrapping;
    beachTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: beachTex } },
      vertexShader: BEACH_CAP_VERT,
      fragmentShader: BEACH_CAP_FRAG,
    });
    return [mat, mat, mat];
  }, [beachTex]);

  const resourceMaterials = useMemo(() => {
    let topTex: THREE.Texture | null = null;
    if (texture) {
      topTex = fitTextureToHex(texture);
      topTex.rotation = Math.PI / 2;
      topTex.center.set(0.5, 0.5);
    }
    return [
      new THREE.MeshStandardMaterial({ color: BORDER_COLOR, roughness: 0.9, metalness: 0.0 }),
      new THREE.MeshStandardMaterial({
        map: topTex,
        color: topTex ? '#ffffff' : BORDER_COLOR,
        roughness: 0.68,
        metalness: 0.04,
        transparent: true,
        alphaTest: 0.05,
      }),
      new THREE.MeshStandardMaterial({ color: BORDER_COLOR, roughness: 1 }),
    ];
  }, [texture]);

  useFrame(({ clock }) => {
    if (!pulseRef.current || !isLegalRobber) return;
    const t = clock.getElapsedTime();
    const mat = pulseRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.2 + Math.abs(Math.sin(t * 2.2)) * 0.35;
  });

  const hasToken = Boolean(tile.resource && tile.number);
  // Robber stands on top of the token disc when present, tile surface otherwise
  const robberBaseY = hasToken ? TOKEN_TOP_Y : INNER_TOP_Y;

  return (
    <group
      position={position}
      onClick={isLegalRobber ? onClick : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Outer slab — full tile radius, beach texture on all faces */}
      <mesh material={beachMaterials} receiveShadow castShadow>
        <cylinderGeometry args={[TILE_RADIUS, TILE_RADIUS, HEX_DEPTH, 6]} />
      </mesh>

      {/* Inner slab — resource texture */}
      <mesh material={resourceMaterials} receiveShadow castShadow>
        <cylinderGeometry args={[INNER_RADIUS, INNER_RADIUS, HEX_DEPTH + 0.004, 6]} />
      </mesh>

      {/* Legal robber pulse overlay */}
      {isLegalRobber && (
        <mesh ref={pulseRef} position={[0, INNER_TOP_Y + 0.002, 0]}>
          <cylinderGeometry args={[INNER_RADIUS, INNER_RADIUS, 0.004, 6]} />
          <meshStandardMaterial color="#64b5f6" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}

      {/* 3D number token — scales with zoom, no pointer event blocking */}
      {hasToken && <NumberToken3D number={tile.number!} />}

      {/* Robber — positioned above token when present */}
      {hasRobber && (
        <group position={[0, robberBaseY, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.14, 0.32, 8]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.44, 0]} castShadow>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.52, 0]} castShadow>
            <coneGeometry args={[0.18, 0.22, 8]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26, 0.025, 8, 24]} />
            <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
