import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { nodeToWorld3D } from '@/entities/board/coordinates';
import type { PortEntry } from '@/shared/types/game';

useGLTF.preload('/assets/models/dock.glb');

const DOCK_SCALE = 0.045;
// How far beyond the edge midpoint the two piers converge (in world units)
const MEETING_OUTSET = 2.2;
// Small gap — each pier stops this far short of the meeting point
const PIER_GAP = 0.18;

interface PierProps {
  nodeId: number;
  meeting: [number, number]; // [x, z] of the convergence point
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
    // Pull back by PIER_GAP so the two piers don't touch at the meeting point
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
    </>
  );
}
