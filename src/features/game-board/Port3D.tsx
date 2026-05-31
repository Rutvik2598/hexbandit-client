import { useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { nodeToWorld3D } from '@/entities/board/coordinates';
import type { PortEntry } from '@/shared/types/game';

useGLTF.preload('/assets/models/dock.glb');

const DOCK_SCALE = 0.045;
const MEETING_OUTSET = 2.2;
const PIER_GAP = 0.18;

const PORT_HEX: Record<string, string> = {
  WOOD:  '/assets/ports/port-hex-wood.png',
  BRICK: '/assets/ports/port-hex-brick.png',
  SHEEP: '/assets/ports/port-hex-sheep.png',
  WHEAT: '/assets/ports/port-hex-wheat.png',
  ORE:   '/assets/ports/port-hex-ore.png',
};

// Flat sprite rendered in 3D space — no HTML portal, no z-index issues
function PortLabel({ src, x, z }: { src: string; x: number; z: number }) {
  const texture = useTexture(src);
  return (
    <mesh position={[x, 0.12, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[1.0, 1.0]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.05}
        depthWrite={false}
      />
    </mesh>
  );
}

interface PierProps {
  nodeId: number;
  meeting: [number, number];
  scene: THREE.Group;
}

function Pier({ nodeId, meeting, scene }: PierProps) {
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });
    return c;
  }, [scene]);

  const { px, pz, angle } = useMemo(() => {
    const [nx, , nz] = nodeToWorld3D(nodeId);
    const dx = meeting[0] - nx;
    const dz = meeting[1] - nz;
    const len = Math.sqrt(dx * dx + dz * dz);
    const ox = dx / len;
    const oz = dz / len;
    return {
      px: nx + ox * (len - PIER_GAP) / 2,
      pz: nz + oz * (len - PIER_GAP) / 2,
      angle: Math.atan2(ox, oz),
    };
  }, [nodeId, meeting]);

  return (
    <group position={[px, 0, pz]} rotation={[0, angle, 0]}>
      <primitive object={cloned} scale={DOCK_SCALE} />
    </group>
  );
}

interface Port3DProps {
  port: PortEntry;
}

export default function Port3D({ port }: Port3DProps) {
  const { scene } = useGLTF('/assets/models/dock.glb') as { scene: THREE.Group };

  const hexSrc = port.resource
    ? PORT_HEX[port.resource] ?? '/assets/ports/port-hex-generic.png'
    : '/assets/ports/port-hex-generic.png';

  const meeting = useMemo<[number, number]>(() => {
    if (!port.nodes || port.nodes.length < 2) return [0, 0];
    const [ax, , az] = nodeToWorld3D(port.nodes[0]);
    const [bx, , bz] = nodeToWorld3D(port.nodes[1]);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    const len = Math.sqrt(mx * mx + mz * mz);
    return [mx + (mx / len) * MEETING_OUTSET, mz + (mz / len) * MEETING_OUTSET];
  }, [port.nodes]);

  if (!port.nodes || port.nodes.length < 2) return null;

  return (
    <>
      <Pier nodeId={port.nodes[0]} meeting={meeting} scene={scene} />
      <Pier nodeId={port.nodes[1]} meeting={meeting} scene={scene} />
      <PortLabel src={hexSrc} x={meeting[0]} z={meeting[1]} />
    </>
  );
}
