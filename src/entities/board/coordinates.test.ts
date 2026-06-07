import { describe, it, expect } from 'vitest'
import {
  parseCubeKey,
  cubeToKey,
  edgeKey,
  areNodesAdjacent,
  getAllEdges,
  getNodesAdjacentToTile,
  NODE_ADJACENCY,
  NODE_COUNT,
  TILE_NODE_MAP,
  nodeToWorld3D,
  tileToWorld3D,
  HEX_RADIUS_3D,
  SQRT3,
} from './coordinates'

// ── parseCubeKey / cubeToKey ─────────────────────────────────────────────────

describe('parseCubeKey / cubeToKey', () => {
  it('round-trips for zero coord', () => {
    expect(parseCubeKey(cubeToKey(0, 0, 0))).toEqual([0, 0, 0])
  })

  it('round-trips for positive coords', () => {
    expect(parseCubeKey(cubeToKey(1, -1, 0))).toEqual([1, -1, 0])
  })

  it('round-trips for negative coords', () => {
    expect(parseCubeKey(cubeToKey(-2, 1, 1))).toEqual([-2, 1, 1])
  })

  it('parses parenthesis format', () => {
    expect(parseCubeKey('(0, -1, 1)')).toEqual([0, -1, 1])
    expect(parseCubeKey('(2, -2, 0)')).toEqual([2, -2, 0])
  })

  it('parses bracket format', () => {
    expect(parseCubeKey('[1, 0, -1]')).toEqual([1, 0, -1])
  })
})

// ── edgeKey ──────────────────────────────────────────────────────────────────

describe('edgeKey', () => {
  it('puts smaller node first', () => {
    expect(edgeKey(5, 2)).toBe('(2, 5)')
    expect(edgeKey(2, 5)).toBe('(2, 5)')
  })

  it('is symmetric — edgeKey(a,b) === edgeKey(b,a)', () => {
    expect(edgeKey(0, 10)).toBe(edgeKey(10, 0))
    expect(edgeKey(1, 53)).toBe(edgeKey(53, 1))
  })

  it('handles equal nodes', () => {
    expect(edgeKey(3, 3)).toBe('(3, 3)')
  })
})

// ── areNodesAdjacent ─────────────────────────────────────────────────────────

describe('areNodesAdjacent', () => {
  it('nodes 0-1 are adjacent (inner ring)', () => {
    expect(areNodesAdjacent(0, 1)).toBe(true)
  })

  it('nodes 0-5 are adjacent (inner ring)', () => {
    expect(areNodesAdjacent(0, 5)).toBe(true)
  })

  it('nodes 1-2 are adjacent (inner ring)', () => {
    expect(areNodesAdjacent(1, 2)).toBe(true)
  })

  it('nodes 0-2 are NOT adjacent (skip a node)', () => {
    expect(areNodesAdjacent(0, 2)).toBe(false)
  })

  it('nodes 0-3 are NOT adjacent (opposite side)', () => {
    expect(areNodesAdjacent(0, 3)).toBe(false)
  })

  it('a node is not adjacent to itself', () => {
    expect(areNodesAdjacent(0, 0)).toBe(false)
  })

  it('returns false for out-of-range node indices', () => {
    expect(areNodesAdjacent(-1, 0)).toBe(false)
    expect(areNodesAdjacent(0, NODE_COUNT)).toBe(false)
    expect(areNodesAdjacent(100, 0)).toBe(false)
  })

  it('is symmetric — areNodesAdjacent(a,b) === areNodesAdjacent(b,a)', () => {
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        expect(areNodesAdjacent(i, j)).toBe(areNodesAdjacent(j, i))
      }
    }
  })
})

// ── NODE_ADJACENCY ───────────────────────────────────────────────────────────

describe('NODE_ADJACENCY', () => {
  it('covers all 54 nodes', () => {
    expect(NODE_ADJACENCY.size).toBe(NODE_COUNT)
    expect(NODE_COUNT).toBe(54)
  })

  it('each node has 2 or 3 neighbors', () => {
    for (const [, neighbors] of NODE_ADJACENCY) {
      expect(neighbors.length).toBeGreaterThanOrEqual(2)
      expect(neighbors.length).toBeLessThanOrEqual(3)
    }
  })

  it('is symmetric — if a→b then b→a', () => {
    for (const [node, neighbors] of NODE_ADJACENCY) {
      for (const neighbor of neighbors) {
        expect(NODE_ADJACENCY.get(neighbor)).toContain(node)
      }
    }
  })

  it('no node lists itself as a neighbor', () => {
    for (const [node, neighbors] of NODE_ADJACENCY) {
      expect(neighbors).not.toContain(node)
    }
  })

  it('no duplicate neighbors in any list', () => {
    for (const [, neighbors] of NODE_ADJACENCY) {
      expect(new Set(neighbors).size).toBe(neighbors.length)
    }
  })
})

// ── getAllEdges ───────────────────────────────────────────────────────────────

describe('getAllEdges', () => {
  it('returns 72 edges for a standard Catan board', () => {
    expect(getAllEdges()).toHaveLength(72)
  })

  it('returns no duplicate edges', () => {
    const edges = getAllEdges()
    const keys = new Set(edges.map(([a, b]) => edgeKey(a, b)))
    expect(keys.size).toBe(edges.length)
  })

  it('returns edges in canonical order (a < b)', () => {
    for (const [a, b] of getAllEdges()) {
      expect(a).toBeLessThan(b)
    }
  })

  it('every edge connects adjacent nodes', () => {
    for (const [a, b] of getAllEdges()) {
      expect(areNodesAdjacent(a, b)).toBe(true)
    }
  })
})

// ── getNodesAdjacentToTile ───────────────────────────────────────────────────

describe('getNodesAdjacentToTile', () => {
  const tiles = ['(0, 0, 0)', '(1, -1, 0)', '(-1, 0, 1)', '(0, 2, -2)', '(2, -2, 0)']

  it('returns exactly 6 nodes per tile', () => {
    for (const tile of tiles) {
      expect(getNodesAdjacentToTile(tile)).toHaveLength(6)
    }
  })

  it('returns no duplicate node IDs', () => {
    for (const tile of tiles) {
      const nodes = getNodesAdjacentToTile(tile)
      expect(new Set(nodes).size).toBe(6)
    }
  })

  it('all returned node IDs are valid (0-53)', () => {
    for (const tile of tiles) {
      for (const n of getNodesAdjacentToTile(tile)) {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThan(NODE_COUNT)
      }
    }
  })

  it('adjacent tiles share exactly 2 nodes', () => {
    const center = new Set(getNodesAdjacentToTile('(0, 0, 0)'))
    const right = new Set(getNodesAdjacentToTile('(1, 0, -1)'))
    const shared = [...center].filter(n => right.has(n))
    expect(shared).toHaveLength(2)
  })
})

// ── TILE_NODE_MAP ─────────────────────────────────────────────────────────────

describe('TILE_NODE_MAP', () => {
  it('covers all 19 tiles', () => {
    expect(TILE_NODE_MAP.size).toBe(19)
  })

  it('every tile has exactly 6 nodes, no duplicates', () => {
    for (const [, nodes] of TILE_NODE_MAP) {
      expect(nodes).toHaveLength(6)
      expect(new Set(nodes).size).toBe(6)
    }
  })

  it('all node IDs across all tiles are valid', () => {
    for (const [, nodes] of TILE_NODE_MAP) {
      for (const n of nodes) {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThan(NODE_COUNT)
      }
    }
  })

  it('contains the center tile key', () => {
    expect(TILE_NODE_MAP.has('(0, 0, 0)')).toBe(true)
  })
})

// ── World coordinate conversion ───────────────────────────────────────────────

describe('tileToWorld3D', () => {
  it('center tile maps to origin', () => {
    const [x, y, z] = tileToWorld3D(0, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBe(0)
    expect(z).toBeCloseTo(0)
  })

  it('y component is always 0 (board lies flat)', () => {
    const coords = [[1, -1], [0, 1], [-1, 0], [2, -2]]
    for (const [cx, cy] of coords) {
      const [, y] = tileToWorld3D(cx, cy)
      expect(y).toBe(0)
    }
  })

  it('adjacent tiles are HEX_RADIUS_3D * sqrt(3) apart along x-axis', () => {
    const [x0] = tileToWorld3D(0, 0)
    const [x1] = tileToWorld3D(1, 0)
    expect(Math.abs(x1 - x0)).toBeCloseTo(HEX_RADIUS_3D * SQRT3)
  })
})

describe('nodeToWorld3D', () => {
  it('returns a three-element tuple', () => {
    const result = nodeToWorld3D(0)
    expect(result).toHaveLength(3)
  })

  it('y component is always 0', () => {
    for (let i = 0; i < NODE_COUNT; i++) {
      const [, y] = nodeToWorld3D(i)
      expect(y).toBe(0)
    }
  })

  it('different nodes produce different world positions', () => {
    const pos0 = nodeToWorld3D(0)
    const pos1 = nodeToWorld3D(1)
    const same = pos0[0] === pos1[0] && pos0[2] === pos1[2]
    expect(same).toBe(false)
  })

  it('is deterministic — same input same output', () => {
    expect(nodeToWorld3D(7)).toEqual(nodeToWorld3D(7))
  })
})
