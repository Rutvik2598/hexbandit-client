import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

const LIFT = 0.155;

const COLOR_ROOF: Record<string, string> = {
  RED:    '#d32f2f',
  BLUE:   '#1565c0',
  WHITE:  '#e0e0e0',
  ORANGE: '#e65100',
};

interface VertexNode3DProps {
  position: [number, number, number];
  building: { type: 'SETTLEMENT' | 'CITY'; color: PlayerColor } | null;
  isLegalSettlement?: boolean;
  isLegalCity?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

function Settlement({ color }: { color: PlayerColor }) {
  const hex = PLAYER_COLORS[color] ?? '#888';
  const roof = COLOR_ROOF[color] ?? '#555';
  return (
    <group>
      {/* House base */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.28, 0.24, 0.28]} />
        <meshStandardMaterial color={hex} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.31, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.22, 0.2, 4]} />
        <meshStandardMaterial color={roof} roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  );
}

function City({ color }: { color: PlayerColor }) {
  const hex = PLAYER_COLORS[color] ?? '#888';
  const roof = COLOR_ROOF[color] ?? '#555';
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.34, 0.4, 0.34]} />
        <meshStandardMaterial color={hex} roughness={0.65} metalness={0.15} />
      </mesh>
      {/* Tower */}
      <mesh position={[0.1, 0.48, 0.1]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.14]} />
        <meshStandardMaterial color={hex} roughness={0.65} metalness={0.15} />
      </mesh>
      {/* Flat roof */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.38, 0.04, 0.38]} />
        <meshStandardMaterial color={roof} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Tower top */}
      <mesh position={[0.1, 0.59, 0.1]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.18]} />
        <meshStandardMaterial color={roof} roughness={0.55} metalness={0.2} />
      </mesh>
    </group>
  );
}

function LegalIndicator({ isHovered }: { isHovered?: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.15;
  });

  return (
    <group>
      {/* Always present — invisible hit area so onPointerEnter fires before the ring appears */}
      <mesh position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <circleGeometry args={[0.28, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>

      {/* Ring — only mounts on hover */}
      {isHovered && (
        <mesh ref={ringRef} position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
          <ringGeometry args={[0.13, 0.28, 48]} />
          <meshBasicMaterial
            color="#2a7040"
            transparent
            opacity={0.7}
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export default function VertexNode3D({
  position,
  building,
  isLegalSettlement,
  isLegalCity,
  isHovered,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: VertexNode3DProps) {
  const isInteractive = isLegalSettlement || isLegalCity;

  if (!building && !isLegalSettlement && !isLegalCity) return null;

  const [bx, , bz] = position;

  return (
    <group
      position={[bx, LIFT, bz]}
      onClick={isInteractive ? onClick : undefined}
      onPointerEnter={isInteractive ? onPointerEnter : undefined}
      onPointerLeave={isInteractive ? onPointerLeave : undefined}
    >
      {building?.type === 'SETTLEMENT' && <Settlement color={building.color} />}
      {building?.type === 'CITY' && <City color={building.color} />}
      {(isLegalSettlement || isLegalCity) && <LegalIndicator isHovered={isHovered} />}
    </group>
  );
}
