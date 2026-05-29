import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

const ROAD_HEIGHT = 0.07;
const ROAD_WIDTH = 0.18;
const ROAD_LIFT = 0.148; // just above tile top

interface RoadEdge3DProps {
  posA: [number, number, number];
  posB: [number, number, number];
  ownerColor?: PlayerColor | null;
  isLegal?: boolean;
  isHovered?: boolean;
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
  onClick,
  onPointerEnter,
  onPointerLeave,
}: RoadEdge3DProps) {
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current || !isLegal || ownerColor) return;
    const t = clock.getElapsedTime();
    const mat = pulseRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.3 + Math.sin(t * 2.5) * 0.25;
  });

  const { midX, midZ, length, angle } = useMemo(() => {
    const dx = posB[0] - posA[0];
    const dz = posB[2] - posA[2];
    return {
      midX: (posA[0] + posB[0]) / 2,
      midZ: (posA[2] + posB[2]) / 2,
      length: Math.sqrt(dx * dx + dz * dz),
      angle: -Math.atan2(dz, dx),
    };
  }, [posA, posB]);

  if (!ownerColor && !isLegal) return null;

  const roadColor = ownerColor ? PLAYER_COLORS[ownerColor] : '#64b5f6';
  const isHoveredLegal = isHovered && isLegal && !ownerColor;

  return (
    <group
      position={[midX, ROAD_LIFT, midZ]}
      rotation={[0, angle, 0]}
      onClick={isLegal ? onClick : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Hit area (wide invisible box) */}
      <mesh visible={false}>
        <boxGeometry args={[length, 0.1, 0.5]} />
        <meshBasicMaterial />
      </mesh>

      {ownerColor ? (
        /* Existing road */
        <group>
          {/* Drop shadow */}
          <mesh position={[0, -0.005, 0.005]}>
            <boxGeometry args={[length - 0.05, ROAD_HEIGHT * 0.6, ROAD_WIDTH]} />
            <meshStandardMaterial color="#000" transparent opacity={0.35} />
          </mesh>
          {/* Road body */}
          <mesh castShadow>
            <boxGeometry args={[length - 0.05, ROAD_HEIGHT, ROAD_WIDTH - 0.02]} />
            <meshStandardMaterial
              color={roadColor}
              roughness={0.65}
              metalness={0.15}
            />
          </mesh>
          {/* Highlight strip */}
          <mesh position={[0, ROAD_HEIGHT / 2 + 0.001, -(ROAD_WIDTH / 2 - 0.05)]}>
            <boxGeometry args={[length - 0.1, 0.008, 0.04]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : (
        /* Legal move indicator */
        <mesh ref={pulseRef} castShadow>
          <boxGeometry args={[length - 0.08, ROAD_HEIGHT * 0.7, ROAD_WIDTH * 0.7]} />
          <meshStandardMaterial
            color={isHoveredLegal ? '#90caf9' : '#64b5f6'}
            emissive="#3080c0"
            emissiveIntensity={0.3}
            transparent
            opacity={isHoveredLegal ? 0.85 : 0.55}
            roughness={0.5}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
