import { describe, it, expect } from 'vitest'
import { parseSuggestionHighlight } from './parseSuggestionHighlight'
import type { ActionPwin } from '@/shared/types/game'

function ap(action_label: string, value?: unknown): ActionPwin {
  return { action_label, pwin_by_color: {}, confidence: 0.8, value }
}

// ── Structured value — settlement ────────────────────────────────────────────

describe('settlement — structured value', () => {
  it('returns settlement highlight with nodeId from numeric value', () => {
    const result = parseSuggestionHighlight(ap('BUILD_SETTLEMENT 5', 5))
    expect(result).toEqual({ type: 'settlement', nodeId: 5 })
  })

  it('matches label containing "settlement" case-insensitively', () => {
    expect(parseSuggestionHighlight(ap('build settlement at 12', 12))).toEqual({ type: 'settlement', nodeId: 12 })
  })
})

// ── Structured value — city ───────────────────────────────────────────────────

describe('city — structured value', () => {
  it('returns city highlight with nodeId from numeric value', () => {
    expect(parseSuggestionHighlight(ap('BUILD_CITY 7', 7))).toEqual({ type: 'city', nodeId: 7 })
  })
})

// ── Structured value — road ───────────────────────────────────────────────────

describe('road — structured value', () => {
  it('returns road highlight with edge from [n1, n2] value', () => {
    expect(parseSuggestionHighlight(ap('BUILD_ROAD', [3, 8]))).toEqual({ type: 'road', edge: [3, 8] })
  })

  it('requires label to contain "road"', () => {
    const result = parseSuggestionHighlight(ap('BUILD_SETTLEMENT', [3, 8]))
    expect(result?.type).not.toBe('road')
  })
})

// ── Structured value — robber ─────────────────────────────────────────────────

describe('robber — structured value', () => {
  it('returns robber highlight from [[q,r,s], victim] value', () => {
    const result = parseSuggestionHighlight(ap('MOVE_ROBBER', [[1, -1, 0], 'BLUE']))
    expect(result).toEqual({ type: 'robber', tileKey: '(1, -1, 0)' })
  })

  it('returns robber highlight from flat [q, r, s] value', () => {
    const result = parseSuggestionHighlight(ap('MOVE_ROBBER', [0, 0, 0]))
    expect(result).toEqual({ type: 'robber', tileKey: '(0, 0, 0)' })
  })

  it('requires label to contain "robber"', () => {
    const result = parseSuggestionHighlight(ap('BUILD_ROAD', [[1, -1, 0], 'BLUE']))
    expect(result?.type).not.toBe('robber')
  })
})

// ── Label parsing — no structured value ───────────────────────────────────────

describe('label parsing fallback', () => {
  it('parses settlement nodeId from label string', () => {
    const result = parseSuggestionHighlight(ap('BUILD_SETTLEMENT (5)'))
    expect(result).toEqual({ type: 'settlement', nodeId: 5 })
  })

  it('parses city nodeId from label string', () => {
    const result = parseSuggestionHighlight(ap('BUILD_CITY (12)'))
    expect(result).toEqual({ type: 'city', nodeId: 12 })
  })

  it('parses road edge from label string', () => {
    const result = parseSuggestionHighlight(ap('BUILD_ROAD (3, 8)'))
    expect(result).toEqual({ type: 'road', edge: [3, 8] })
  })

  it('parses robber tile from label string — nested format', () => {
    const result = parseSuggestionHighlight(ap('MOVE_ROBBER ((1, -1, 0), None)'))
    expect(result).toEqual({ type: 'robber', tileKey: '(1, -1, 0)' })
  })

  it('parses robber tile from label string — flat format', () => {
    const result = parseSuggestionHighlight(ap('MOVE_ROBBER (0, 0, 0)'))
    expect(result).toEqual({ type: 'robber', tileKey: '(0, 0, 0)' })
  })

  it('uses last number in label for settlement when multiple numbers present', () => {
    const result = parseSuggestionHighlight(ap('BUILD_SETTLEMENT node 42 of 54'))
    expect(result).toEqual({ type: 'settlement', nodeId: 54 })
  })
})

// ── Actions with no location → null ──────────────────────────────────────────

describe('returns null for actions with no location', () => {
  it('ROLL — no numbers in label', () => {
    expect(parseSuggestionHighlight(ap('ROLL'))).toBeNull()
  })

  it('BUY_DEVELOPMENT_CARD — no numbers', () => {
    expect(parseSuggestionHighlight(ap('BUY_DEVELOPMENT_CARD'))).toBeNull()
  })

  it('END_TURN — no numbers', () => {
    expect(parseSuggestionHighlight(ap('END_TURN'))).toBeNull()
  })

  it('null value and no parseable label → null', () => {
    expect(parseSuggestionHighlight(ap('UNKNOWN_ACTION', null))).toBeNull()
  })

  it('label with numbers but no recognised action keyword → null', () => {
    expect(parseSuggestionHighlight(ap('SOMETHING 42'))).toBeNull()
  })
})
