import { describe, it, expect } from 'vitest'
import { formatSuggestionLabel } from './formatSuggestionLabel'
import type { ActionPwin } from '@/shared/types/game'

function ap(action_label: string, value?: unknown): ActionPwin {
  return { action_label, pwin_by_color: {}, confidence: 0.8, value }
}

// ── Already-readable labels ───────────────────────────────────────────────────

describe('already-readable labels (pass-through)', () => {
  it('returns the label unchanged when it starts with lowercase', () => {
    expect(formatSuggestionLabel(ap('build settlement at node 5'))).toBe('build settlement at node 5')
  })

  it('returns the label unchanged for mixed-case sentences', () => {
    expect(formatSuggestionLabel(ap('Roll the dice'))).toBe('Roll the dice')
  })
})

// ── Simple action type overrides ──────────────────────────────────────────────

describe('simple ACTION_TYPE overrides', () => {
  const cases: [string, string][] = [
    ['BUILD_SETTLEMENT',     'Build Settlement'],
    ['BUILD_CITY',           'Build City'],
    ['BUILD_ROAD',           'Build Road'],
    ['BUY_DEVELOPMENT_CARD', 'Buy Dev Card'],
    ['PLAY_KNIGHT_CARD',     'Play Knight'],
    ['PLAY_YEAR_OF_PLENTY',  'Year of Plenty'],
    ['PLAY_MONOPOLY',        'Monopoly'],
    ['PLAY_ROAD_BUILDING',   'Road Building'],
    ['MOVE_ROBBER',          'Move Robber'],
    ['END_TURN',             'End Turn'],
    ['ROLL',                 'Roll Dice'],
    ['DISCARD',              'Discard Cards'],
  ]

  for (const [label, expected] of cases) {
    it(`${label} → "${expected}"`, () => {
      expect(formatSuggestionLabel(ap(label))).toBe(expected)
    })
  }

  it('action types with extra data after a space still match', () => {
    expect(formatSuggestionLabel(ap('BUILD_SETTLEMENT 5'))).toBe('Build Settlement')
    expect(formatSuggestionLabel(ap('MOVE_ROBBER (0, 0, 0)'))).toBe('Move Robber')
  })
})

// ── Unknown action types → title-cased ───────────────────────────────────────

describe('unknown action types', () => {
  it('title-cases an unknown ALL_CAPS action type', () => {
    expect(formatSuggestionLabel(ap('SOME_FUTURE_ACTION'))).toBe('Some Future Action')
  })

  it('title-cases a single-word unknown action', () => {
    expect(formatSuggestionLabel(ap('SPECIAL'))).toBe('Special')
  })
})

// ── MARITIME_TRADE ────────────────────────────────────────────────────────────

describe('MARITIME_TRADE', () => {
  it('formats from structured numeric value array (4:1 wood → ore)', () => {
    // giving 4× wood (index 0), asking ore (index 4)
    const result = formatSuggestionLabel(ap('MARITIME_TRADE', [0, 0, 0, 0, 4]))
    expect(result).toContain('4:1')
    expect(result).toContain('🪵')
    expect(result).toContain('⛏️')
    expect(result).toContain('Wood')
    expect(result).toContain('Ore')
  })

  it('formats from structured value (3:1 sheep → wheat)', () => {
    // three sheep indices (2, 2, 2) then asking wheat index (3) → rate = 3
    const result = formatSuggestionLabel(ap('MARITIME_TRADE', [2, 2, 2, 3]))
    expect(result).toContain('3:1')
    expect(result).toContain('🐑')
    expect(result).toContain('🌾')
  })

  it('formats from label string when value is missing', () => {
    const result = formatSuggestionLabel(ap('MARITIME_TRADE (0, 0, 0, 0, 4)'))
    expect(result).toContain('4:1')
    expect(result).toContain('🪵')
    expect(result).toContain('⛏️')
  })

  it('falls back to "Maritime Trade" when no parseable data', () => {
    expect(formatSuggestionLabel(ap('MARITIME_TRADE'))).toBe('Maritime Trade')
  })

  it('falls back when value is non-numeric', () => {
    expect(formatSuggestionLabel(ap('MARITIME_TRADE', { foo: 1 }))).toBe('Maritime Trade')
  })
})

// ── OFFER_TRADE ───────────────────────────────────────────────────────────────

describe('OFFER_TRADE', () => {
  it('formats from structured [[give], [want]] value', () => {
    // give 2 wood, want 1 ore
    const result = formatSuggestionLabel(ap('OFFER_TRADE', [[2, 0, 0, 0, 0], [0, 0, 0, 0, 1]]))
    expect(result).toContain('Give')
    expect(result).toContain('Want')
    expect(result).toContain('🪵')
    expect(result).toContain('⛏️')
  })

  it('formats give count ×N when count > 1', () => {
    const result = formatSuggestionLabel(ap('OFFER_TRADE', [[3, 0, 0, 0, 0], [0, 0, 0, 0, 1]]))
    expect(result).toContain('3×')
    expect(result).toContain('🪵')
  })

  it('falls back to label string parsing (10-number format)', () => {
    // give 1 wood (idx 0), want 1 ore (idx 4) — encoded as [1,0,0,0,0, 0,0,0,0,1]
    const result = formatSuggestionLabel(ap('OFFER_TRADE 1 0 0 0 0 0 0 0 0 1'))
    expect(result).toContain('Give')
    expect(result).toContain('Want')
  })

  it('falls back to "Offer Trade" when no parseable data', () => {
    expect(formatSuggestionLabel(ap('OFFER_TRADE'))).toBe('Offer Trade')
  })

  it('falls back to "Offer Trade" when all freqdeck counts are zero', () => {
    const result = formatSuggestionLabel(ap('OFFER_TRADE', [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]))
    expect(result).toBe('Offer Trade')
  })
})
