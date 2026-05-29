import { useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TileEntry } from '@/shared/types/game';
import { fitTextureToHex } from '@/shared/utils/textureUtils';

// Slightly under gapless (1.2) so a thin white gap is visible between tiles
const TILE_RADIUS = 1.19;
const HEX_DEPTH = 0.10;
// White border color shown in the gap between tiles
const BORDER_COLOR = '#f0f2f8';

const NUMBER_DOTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

function NumberToken({ number }: { number: number }) {
  const isRed = number === 6 || number === 8;
  const dots = NUMBER_DOTS[number] || 0;
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #fff8e8 0%, #f0d898 55%, #c8a040 100%)',
        border: '1.5px solid rgba(160,110,30,0.5)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'serif', lineHeight: 1, color: isRed ? '#c41a1a' : '#2a1a08' }}>
        {number}
      </span>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: dots }).map((_, i) => (
          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: isRed ? '#c41a1a' : '#4a3010' }} />
        ))}
      </div>
    </div>
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

  // Reliable multi-material: pass array directly to mesh.material prop
  const materials = useMemo(() => {
    let topTex: THREE.Texture | null = null;
    if (texture) {
      // Scale content to fill UV hex (handles inset padding in transparent PNGs),
      // then orient +90° so North direction maps to image top.
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  useFrame(({ clock }) => {
    if (!pulseRef.current || !isLegalRobber) return;
    const t = clock.getElapsedTime();
    const mat = pulseRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.2 + Math.abs(Math.sin(t * 2.2)) * 0.35;
  });

  return (
    <group
      position={position}
      onClick={isLegalRobber ? onClick : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Tile slab — no Y-rotation: default CylinderGeometry already orients flat edges
          toward neighbor tile centers for our axial→world coordinate formula */}
      <mesh material={materials} receiveShadow castShadow>
        <cylinderGeometry args={[TILE_RADIUS, TILE_RADIUS, HEX_DEPTH, 6]} />
      </mesh>

      {/* Legal robber overlay */}
      {isLegalRobber && (
        <mesh
          ref={pulseRef}
          position={[0, HEX_DEPTH / 2 + 0.002, 0]}
        >
          <cylinderGeometry args={[TILE_RADIUS, TILE_RADIUS, 0.004, 6]} />
          <meshStandardMaterial color="#64b5f6" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}

      {/* Number token (HTML overlay) */}
      {tile.resource && tile.number && (
        <Html position={[0, HEX_DEPTH / 2 + 0.02, 0]} center zIndexRange={[0, 10]} occlude={false}>
          <NumberToken number={tile.number} />
        </Html>
      )}

      {/* Robber figure */}
      {hasRobber && (
        <group position={[0, HEX_DEPTH / 2, 0]}>
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
