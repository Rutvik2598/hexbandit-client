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

const LIFT = 0.0;

const S_SCALE = 0.30 / 12;
const S_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];

const C_SCALE = 0.40 / 20;
const C_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];

// Returns [dx, dy, dz] that centres the transformed model with its base at Y=0.
function computeAnchor(
  scene: THREE.Group,
  rotation: [number, number, number],
  scale: number,
): [number, number, number] {
  const pivot = new THREE.Group();
  pivot.rotation.set(...rotation);
  pivot.scale.setScalar(scale);
  pivot.add(scene.clone(true));
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  return [
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2,
  ];
}

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
  const { cloned, anchor } = useMemo(() => {
    const cloned = applyPlayerColor(scene, PLAYER_COLORS[color] ?? '#888', 0.7, 0.1);
    const anchor = computeAnchor(scene, S_ROTATION, S_SCALE);
    return { cloned, anchor };
  }, [scene, color]);
  const dropRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  useFrame((_, delta) => {
    if (!dropRef.current || tRef.current >= 1) return;
    tRef.current = Math.min(tRef.current + delta * ANIM_SPEED, 1);
    dropRef.current.position.y = DROP_HEIGHT * (1 - springDrop(tRef.current));
  });
  return (
    <group ref={dropRef} position={[0, DROP_HEIGHT, 0]}>
      <group position={anchor}>
        <primitive object={cloned} rotation={S_ROTATION} scale={S_SCALE} />
      </group>
    </group>
  );
}

function City({ color }: { color: PlayerColor }) {
  const { scene } = useGLTF('/assets/models/city.glb') as { scene: THREE.Group };
  const { cloned, anchor } = useMemo(() => {
    const cloned = applyPlayerColor(scene, PLAYER_COLORS[color] ?? '#888', 0.65, 0.15);
    const anchor = computeAnchor(scene, C_ROTATION, C_SCALE);
    return { cloned, anchor };
  }, [scene, color]);
  const dropRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  useFrame((_, delta) => {
    if (!dropRef.current || tRef.current >= 1) return;
    tRef.current = Math.min(tRef.current + delta * ANIM_SPEED, 1);
    dropRef.current.position.y = DROP_HEIGHT * (1 - springDrop(tRef.current));
  });
  return (
    <group ref={dropRef} position={[0, DROP_HEIGHT, 0]}>
      <group position={anchor}>
        <primitive object={cloned} rotation={C_ROTATION} scale={C_SCALE} />
      </group>
    </group>
  );
}

function LegalIndicator({ isHovered, isPreview }: { isHovered?: boolean; isPreview?: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    const base = isHovered ? 0.78 : 0.40;
    const amp  = isHovered ? 0.14 : 0.10;
    mat.opacity = base + Math.sin(clock.getElapsedTime() * 3) * amp;
  });

  return (
    <group>
      <mesh position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <circleGeometry args={[0.28, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
        <ringGeometry args={[0.13, 0.28, 48]} />
        <meshBasicMaterial
          color={isPreview ? (isHovered ? '#86efac' : '#4ade80') : (isHovered ? '#90caf9' : '#4f8dff')}
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
  isPreview?: boolean;
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
  isPreview,
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
      {(isLegalSettlement || isLegalCity) && <LegalIndicator isHovered={isHovered} isPreview={isPreview} />}
    </group>
  );
}
