// Board coordinate system for Hexbandit (Catan)
// Uses cube coordinates [x, y, z] where x+y+z=0

export const SQRT3 = Math.sqrt(3);

// Node fractional cube coordinates from COORDINATES.md
// Each entry: node_id -> [x, y, z] as fractions
const NODE_CENTERS_RAW: [number, number, number][] = [
  [1/3, 1/3, -2/3],    // 0
  [2/3, -1/3, -1/3],   // 1
  [1/3, -2/3, 1/3],    // 2
  [-1/3, -1/3, 2/3],   // 3
  [-2/3, 1/3, 1/3],    // 4
  [-1/3, 2/3, -1/3],   // 5
  [4/3, -2/3, -2/3],   // 6
  [5/3, -4/3, -1/3],   // 7
  [4/3, -5/3, 1/3],    // 8
  [2/3, -4/3, 2/3],    // 9
  [1/3, -5/3, 4/3],    // 10
  [-1/3, -4/3, 5/3],   // 11
  [-2/3, -2/3, 4/3],   // 12
  [-4/3, -1/3, 5/3],   // 13
  [-5/3, 1/3, 4/3],    // 14
  [-4/3, 2/3, 2/3],    // 15
  [-2/3, 4/3, -2/3],   // 16
  [-5/3, 4/3, 1/3],    // 17
  [-4/3, 5/3, -1/3],   // 18
  [1/3, 4/3, -5/3],    // 19
  [2/3, 2/3, -4/3],    // 20
  [-1/3, 5/3, -4/3],   // 21
  [4/3, 1/3, -5/3],    // 22
  [5/3, -1/3, -4/3],   // 23
  [7/3, -5/3, -2/3],   // 24
  [8/3, -7/3, -1/3],   // 25
  [7/3, -8/3, 1/3],    // 26
  [5/3, -7/3, 2/3],    // 27
  [4/3, -8/3, 4/3],    // 28
  [2/3, -7/3, 5/3],    // 29
  [1/3, -8/3, 7/3],    // 30
  [-1/3, -7/3, 8/3],   // 31
  [-2/3, -5/3, 7/3],   // 32
  [-4/3, -4/3, 8/3],   // 33
  [-5/3, -2/3, 7/3],   // 34
  [-7/3, -1/3, 8/3],   // 35
  [-8/3, 1/3, 7/3],    // 36
  [-7/3, 2/3, 5/3],    // 37
  [-8/3, 4/3, 4/3],    // 38
  [-7/3, 5/3, 2/3],    // 39
  [-5/3, 7/3, -2/3],   // 40
  [-8/3, 7/3, 1/3],    // 41
  [-7/3, 8/3, -1/3],   // 42
  [-2/3, 7/3, -5/3],   // 43
  [-4/3, 8/3, -4/3],   // 44
  [1/3, 7/3, -8/3],    // 45
  [2/3, 5/3, -7/3],    // 46
  [-1/3, 8/3, -7/3],   // 47
  [4/3, 4/3, -8/3],    // 48
  [5/3, 2/3, -7/3],    // 49
  [7/3, 1/3, -8/3],    // 50
  [8/3, -1/3, -7/3],   // 51
  [7/3, -2/3, -5/3],   // 52
  [8/3, -4/3, -4/3],   // 53
];

export const NODE_COUNT = 54;

// Parse a cube coordinate key like "(0, -1, 1)" or "[0, -1, 1]"
export function parseCubeKey(key: string): [number, number, number] {
  const nums = key.replace(/[()[\]]/g, '').split(',').map(Number) as [number, number, number];
  return nums;
}

// Format cube coordinate to key
export function cubeToKey(x: number, y: number, z: number): string {
  return `(${x}, ${y}, ${z})`;
}

// Parse edge key "(a, b)" → [a, b]
export function parseEdgeKey(key: string): [number, number] {
  const parts = key.replace(/[()[\]]/g, '').split(',').map(Number);
  return [parts[0], parts[1]];
}

// Canonical edge key (smaller node first)
export function edgeKey(a: number, b: number): string {
  return `(${Math.min(a, b)}, ${Math.max(a, b)})`;
}

// Check if two nodes are adjacent (share an edge)
// Derived by checking if their cube positions differ by exactly one edge
export function areNodesAdjacent(a: number, b: number): boolean {
  if (a < 0 || a >= NODE_COUNT || b < 0 || b >= NODE_COUNT) return false;
  const [ax, ay] = NODE_CENTERS_RAW[a];
  const [bx, by] = NODE_CENTERS_RAW[b];
  // Adjacent nodes are exactly 2/3 apart in cube space (verified: 0↔1, 0↔5, 0↔20 all = 2/3)
  const dx = bx - ax;
  const dy = by - ay;
  const dz = -dx - dy;
  const dist = (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) / 2;
  return Math.abs(dist - 2/3) < 0.01;
}

// Build adjacency map for all nodes (precomputed for performance)
function buildAdjacencyMap(): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let i = 0; i < NODE_COUNT; i++) {
    const neighbors: number[] = [];
    for (let j = 0; j < NODE_COUNT; j++) {
      if (i !== j && areNodesAdjacent(i, j)) {
        neighbors.push(j);
      }
    }
    map.set(i, neighbors);
  }
  return map;
}

export const NODE_ADJACENCY = buildAdjacencyMap();

// Get all edges as pairs of node IDs
export function getAllEdges(): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const [node, neighbors] of NODE_ADJACENCY) {
    for (const neighbor of neighbors) {
      const key = edgeKey(node, neighbor);
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([Math.min(node, neighbor), Math.max(node, neighbor)]);
      }
    }
  }
  return edges;
}

// Get nodes adjacent to a tile (by finding nodes whose cube center is within the tile's corners)
export function getNodesAdjacentToTile(tileKey: string): number[] {
  const [tx, ty] = parseCubeKey(tileKey);
  const nodeIds: number[] = [];

  // Corner offsets from COORDINATES.md
  const offsets: [number, number, number][] = [
    [1/3, 1/3, -2/3],    // NORTH
    [2/3, -1/3, -1/3],   // NORTHEAST
    [1/3, -2/3, 1/3],    // SOUTHEAST
    [-1/3, -1/3, 2/3],   // SOUTH
    [-2/3, 1/3, 1/3],    // SOUTHWEST
    [-1/3, 2/3, -1/3],   // NORTHWEST
  ];

  for (const [dx, dy] of offsets) {
    const cx = tx + dx;
    const cy = ty + dy;
    // Find matching node
    for (let i = 0; i < NODE_COUNT; i++) {
      const [nx, ny] = NODE_CENTERS_RAW[i];
      if (Math.abs(nx - cx) < 0.01 && Math.abs(ny - cy) < 0.01) {
        nodeIds.push(i);
        break;
      }
    }
  }

  return nodeIds;
}

// Build tile → nodes map
function buildTileNodeMap(): Map<string, number[]> {
  const tileCoords = [
    [0, 0, 0], [1, -1, 0], [0, -1, 1], [-1, 0, 1], [-1, 1, 0],
    [0, 1, -1], [1, 0, -1], [2, -2, 0], [1, -2, 1], [0, -2, 2],
    [-1, -1, 2], [-2, 0, 2], [-2, 1, 1], [-2, 2, 0], [-1, 2, -1],
    [0, 2, -2], [1, 1, -2], [2, 0, -2], [2, -1, -1],
  ];
  const map = new Map<string, number[]>();
  for (const [x, y, z] of tileCoords) {
    const key = cubeToKey(x, y, z);
    map.set(key, getNodesAdjacentToTile(key));
  }
  return map;
}

export const TILE_NODE_MAP = buildTileNodeMap();

// Export raw node centers for any consumers that need them
export const NODE_CENTERS = NODE_CENTERS_RAW;

// ── 3D world coordinates ──────────────────────────────────────────────────────
// Board lies in the XZ plane (Three.js Y-up convention). Y=0 is the tile surface.

export const HEX_RADIUS_3D = 1.2; // grid spacing radius; tiles use 0.96× for a small gap

export function tileToWorld3D(cubeX: number, cubeY: number): [number, number, number] {
  const wx = HEX_RADIUS_3D * (SQRT3 * cubeX + (SQRT3 / 2) * cubeY);
  const wz = HEX_RADIUS_3D * (1.5 * cubeY);
  return [wx, 0, wz];
}

export function nodeToWorld3D(nodeId: number): [number, number, number] {
  const [cx, cy] = NODE_CENTERS_RAW[nodeId];
  const wx = HEX_RADIUS_3D * (SQRT3 * cx + (SQRT3 / 2) * cy);
  const wz = HEX_RADIUS_3D * (1.5 * cy);
  return [wx, 0, wz];
}
