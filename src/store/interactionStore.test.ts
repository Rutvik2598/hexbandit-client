import { beforeEach, describe, it, expect } from 'vitest'
import { useInteractionStore, type InteractionMode } from './interactionStore'

// Reset store to a clean slate before each test — stores are module-level singletons.
beforeEach(() => {
  useInteractionStore.getState().resetInteraction()
})

// ── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts in IDLE mode', () => {
    expect(useInteractionStore.getState().mode).toBe('IDLE')
  })

  it('has no hovered node', () => {
    expect(useInteractionStore.getState().hoveredNode).toBeNull()
  })

  it('has no hovered edge', () => {
    expect(useInteractionStore.getState().hoveredEdge).toBeNull()
  })

  it('has no hovered tile', () => {
    expect(useInteractionStore.getState().hoveredTile).toBeNull()
  })

  it('has no preview highlight', () => {
    const { previewNode, previewEdge, previewTile, previewType } = useInteractionStore.getState()
    expect(previewNode).toBeNull()
    expect(previewEdge).toBeNull()
    expect(previewTile).toBeNull()
    expect(previewType).toBeNull()
  })
})

// ── setMode ───────────────────────────────────────────────────────────────────

describe('setMode', () => {
  const modes: InteractionMode[] = [
    'BUILD_ROAD',
    'BUILD_SETTLEMENT',
    'BUILD_CITY',
    'MOVE_ROBBER',
    'DISCARD',
    'YEAR_OF_PLENTY',
    'MONOPOLY',
    'MARITIME_TRADE',
    'OFFER_TRADE',
  ]

  for (const mode of modes) {
    it(`transitions to ${mode}`, () => {
      useInteractionStore.getState().setMode(mode)
      expect(useInteractionStore.getState().mode).toBe(mode)
    })
  }

  it('can switch between modes', () => {
    useInteractionStore.getState().setMode('BUILD_ROAD')
    useInteractionStore.getState().setMode('BUILD_CITY')
    expect(useInteractionStore.getState().mode).toBe('BUILD_CITY')
  })

  it('can return to IDLE', () => {
    useInteractionStore.getState().setMode('BUILD_ROAD')
    useInteractionStore.getState().setMode('IDLE')
    expect(useInteractionStore.getState().mode).toBe('IDLE')
  })
})

// ── Hover setters ─────────────────────────────────────────────────────────────

describe('setHoveredNode', () => {
  it('sets a hovered node ID', () => {
    useInteractionStore.getState().setHoveredNode(7)
    expect(useInteractionStore.getState().hoveredNode).toBe(7)
  })

  it('clears hovered node with null', () => {
    useInteractionStore.getState().setHoveredNode(7)
    useInteractionStore.getState().setHoveredNode(null)
    expect(useInteractionStore.getState().hoveredNode).toBeNull()
  })
})

describe('setHoveredEdge', () => {
  it('sets a hovered edge', () => {
    useInteractionStore.getState().setHoveredEdge([3, 8])
    expect(useInteractionStore.getState().hoveredEdge).toEqual([3, 8])
  })

  it('clears hovered edge with null', () => {
    useInteractionStore.getState().setHoveredEdge([3, 8])
    useInteractionStore.getState().setHoveredEdge(null)
    expect(useInteractionStore.getState().hoveredEdge).toBeNull()
  })
})

describe('setHoveredTile', () => {
  it('sets a hovered tile key', () => {
    useInteractionStore.getState().setHoveredTile('(0, 0, 0)')
    expect(useInteractionStore.getState().hoveredTile).toBe('(0, 0, 0)')
  })

  it('clears hovered tile with null', () => {
    useInteractionStore.getState().setHoveredTile('(0, 0, 0)')
    useInteractionStore.getState().setHoveredTile(null)
    expect(useInteractionStore.getState().hoveredTile).toBeNull()
  })
})

// ── Preview highlight ─────────────────────────────────────────────────────────

describe('setPreviewHighlight', () => {
  it('sets node preview', () => {
    useInteractionStore.getState().setPreviewHighlight(5, null, 'settlement')
    const s = useInteractionStore.getState()
    expect(s.previewNode).toBe(5)
    expect(s.previewEdge).toBeNull()
    expect(s.previewType).toBe('settlement')
  })

  it('sets edge preview', () => {
    useInteractionStore.getState().setPreviewHighlight(null, [2, 9], 'road')
    const s = useInteractionStore.getState()
    expect(s.previewNode).toBeNull()
    expect(s.previewEdge).toEqual([2, 9])
    expect(s.previewType).toBe('road')
  })

  it('sets city preview', () => {
    useInteractionStore.getState().setPreviewHighlight(12, null, 'city')
    expect(useInteractionStore.getState().previewType).toBe('city')
  })

  it('sets tile preview when provided', () => {
    useInteractionStore.getState().setPreviewHighlight(null, null, null, '(1, -1, 0)')
    expect(useInteractionStore.getState().previewTile).toBe('(1, -1, 0)')
  })

  it('defaults tile to null when not provided', () => {
    useInteractionStore.getState().setPreviewHighlight(3, null, 'settlement')
    expect(useInteractionStore.getState().previewTile).toBeNull()
  })
})

describe('clearPreviewHighlight', () => {
  it('clears all preview fields', () => {
    useInteractionStore.getState().setPreviewHighlight(5, [2, 9], 'settlement', '(0, 0, 0)')
    useInteractionStore.getState().clearPreviewHighlight()
    const s = useInteractionStore.getState()
    expect(s.previewNode).toBeNull()
    expect(s.previewEdge).toBeNull()
    expect(s.previewTile).toBeNull()
    expect(s.previewType).toBeNull()
  })

  it('does not affect mode or hover state', () => {
    useInteractionStore.getState().setMode('BUILD_ROAD')
    useInteractionStore.getState().setHoveredNode(3)
    useInteractionStore.getState().setPreviewHighlight(5, null, 'road')
    useInteractionStore.getState().clearPreviewHighlight()
    const s = useInteractionStore.getState()
    expect(s.mode).toBe('BUILD_ROAD')
    expect(s.hoveredNode).toBe(3)
  })
})

// ── resetInteraction ──────────────────────────────────────────────────────────

describe('resetInteraction', () => {
  it('resets mode to IDLE', () => {
    useInteractionStore.getState().setMode('BUILD_CITY')
    useInteractionStore.getState().resetInteraction()
    expect(useInteractionStore.getState().mode).toBe('IDLE')
  })

  it('clears all hover state', () => {
    useInteractionStore.getState().setHoveredNode(10)
    useInteractionStore.getState().setHoveredEdge([1, 5])
    useInteractionStore.getState().setHoveredTile('(0, 1, -1)')
    useInteractionStore.getState().resetInteraction()
    const s = useInteractionStore.getState()
    expect(s.hoveredNode).toBeNull()
    expect(s.hoveredEdge).toBeNull()
    expect(s.hoveredTile).toBeNull()
  })

  it('clears all preview state', () => {
    useInteractionStore.getState().setPreviewHighlight(7, [2, 3], 'city', '(0, 0, 0)')
    useInteractionStore.getState().resetInteraction()
    const s = useInteractionStore.getState()
    expect(s.previewNode).toBeNull()
    expect(s.previewEdge).toBeNull()
    expect(s.previewTile).toBeNull()
    expect(s.previewType).toBeNull()
  })
})
