import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const DROP_HEIGHT = 4.0;
const ANIM_SPEED = 1.6;

function springDrop(t: number): number {
  return 1 - Math.exp(-t * 8) * Math.cos(t * Math.PI * 2);
}
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

useGLTF.preload('/assets/models/settlement.glb');
useGLTF.preload('/assets/models/city.glb');

const LIFT = 0.155;

// Sketchfab root bakes Z-up→Y-up: model-Z→worldY, model-Y→world(-Z).
// The models were originally Y-up STLs, so their actual height axis (model Y) ends up in
// world -Z. Rx(PI/2) maps world -Z → world +Y to stand each piece upright.
// After that rotation, the scale/centering is based on the original accessor bounds:
//   Settlement: accessor X=[8.313,18.313] cx=13.313 | Y=[1.519,13.519] height=12 | Z=[0,14] depth-center=7
//   City:       accessor X=[22.562,42.562] cx=32.562 | Y=[1.519,21.519] height=20 | Z=[0,10] depth-center=5
const S_SCALE = 0.30 / 12;
const S_POS: [number, number, number] = [
  -13.313 * S_SCALE,
  -1.519 * S_SCALE,
  -7.0 * S_SCALE,
];

const C_SCALE = 0.40 / 20;
const C_POS: [number, number, number] = [
  -32.562 * C_SCALE,
  -1.519 * C_SCALE,
  -5.0 * C_SCALE,
];

function applyPlayerColor(
  scene: THREE.Group,
  color: string,
  roughness: number,
  metalness: number,
): THREE.Group {
  const cloned = scene.clone(true);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  cloned.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.material = mat;
      obj.castShadow = true;
    }
  });
  return cloned;
}

function Settlement({ color }: { color: PlayerColor }) {
  const { scene } = useGLTF('/assets/models/settlement.glb') as { scene: THREE.Group };
  const cloned = useMemo(
    () => applyPlayerColor(scene, PLAYER_COLORS[color] ?? '#888', 0.7, 0.1),
    [scene, color],
  );
  const dropRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  useFrame((_, delta) => {
    if (!dropRef.current || tRef.current >= 1) return;
    tRef.current = Math.min(tRef.current + delta * ANIM_SPEED, 1);
    dropRef.current.position.y = DROP_HEIGHT * (1 - springDrop(tRef.current));
  });
  return (
    <group ref={dropRef} position={[0, DROP_HEIGHT, 0]}>
      <primitive object={cloned} rotation={[Math.PI / 2, 0, 0]} position={S_POS} scale={S_SCALE} />
    </group>
  );
}

function City({ color }: { color: PlayerColor }) {
  const { scene } = useGLTF('/assets/models/city.glb') as { scene: THREE.Group };
  const cloned = useMemo(
    () => applyPlayerColor(scene, PLAYER_COLORS[color] ?? '#888', 0.65, 0.15),
    [scene, color],
  );
  const dropRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  useFrame((_, delta) => {
    if (!dropRef.current || tRef.current >= 1) return;
    tRef.current = Math.min(tRef.current + delta * ANIM_SPEED, 1);
    dropRef.current.position.y = DROP_HEIGHT * (1 - springDrop(tRef.current));
  });
  return (
    <group ref={dropRef} position={[0, DROP_HEIGHT, 0]}>
      <primitive object={cloned} rotation={[Math.PI / 2, 0, 0]} position={C_POS} scale={C_SCALE} />
    </group>
  );
}

function LegalIndicator({ isHovered }: { isHovered?: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    // Pulse gently; brighter on hover
    const base = isHovered ? 0.78 : 0.40;
    const amp  = isHovered ? 0.14 : 0.10;
    mat.opacity = base + Math.sin(clock.getElapsedTime() * 3) * amp;
  });

  return (
    <group>
      {/* Invisible hit area */}
      <mesh position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <circleGeometry args={[0.28, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>

      {/* Ring always visible when legal — not just on hover */}
      <mesh ref={ringRef} position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
        <ringGeometry args={[0.13, 0.28, 48]} />
        <meshBasicMaterial
          color={isHovered ? '#90caf9' : '#4f8dff'}
          transparent
          opacity={0.38}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

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
