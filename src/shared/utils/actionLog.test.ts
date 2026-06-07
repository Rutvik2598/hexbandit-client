import { describe, it, expect } from 'vitest'
import { extractRollDice, extractRollGains, formatActionLogEvent } from './actionLog'
import type { ActionLogEvent, Player } from '@/shared/types/game'

function makeEvent(overrides: Partial<ActionLogEvent> = {}): ActionLogEvent {
  return { action_type: 'ROLL', color: 'RED', value: null, ...overrides }
}

function makePlayer(color: string, name: string): Player {
  return {
    index: 0,
    color: color as Player['color'],
    name,
    victory_points: 0,
    resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
    settlements: 0,
    cities: 0,
    roads_built: 0,
    has_longest_road: false,
    has_largest_army: false,
    longest_road_length: 0,
    knights_played: 0,
    num_dev_cards: 0,
    dev_cards_private: { knight: 0, year_of_plenty: 0, monopoly: 0, road_building: 0, victory_point: 0 },
    dev_cards_played: { knight: 0, year_of_plenty: 0, monopoly: 0, road_building: 0, victory_point: 0 },
    port_resources: [],
  }
}

const PLAYERS: Player[] = [makePlayer('RED', 'Alice'), makePlayer('BLUE', 'Bob')]

// ── extractRollDice ───────────────────────────────────────────────────────────

describe('extractRollDice', () => {
  it('extracts dice from a valid value array', () => {
    expect(extractRollDice(makeEvent({ value: [3, 4] }))).toEqual([3, 4])
    expect(extractRollDice(makeEvent({ value: [1, 6] }))).toEqual([1, 6])
  })

  it('returns null when value is null', () => {
    expect(extractRollDice(makeEvent({ value: null }))).toBeNull()
  })

  it('returns null when value is a string', () => {
    expect(extractRollDice(makeEvent({ value: '3+4' }))).toBeNull()
  })

  it('returns null when array has wrong length', () => {
    expect(extractRollDice(makeEvent({ value: [3] }))).toBeNull()
    expect(extractRollDice(makeEvent({ value: [3, 4, 5] }))).toBeNull()
  })

  it('returns null when array elements are not numbers', () => {
    expect(extractRollDice(makeEvent({ value: ['3', '4'] }))).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(extractRollDice(makeEvent({ value: [] }))).toBeNull()
  })
})

// ── extractRollGains ─────────────────────────────────────────────────────────

describe('extractRollGains', () => {
  it('returns gains for a valid result object', () => {
    const event = makeEvent({ result: { RED: [2, 0, 1, 0, 0] } })
    const gains = extractRollGains(event)
    expect(gains).not.toBeNull()
    expect(gains!['RED']).toEqual({ wood: 2, sheep: 1 })
  })

  it('filters out zero-count resources', () => {
    const event = makeEvent({ result: { RED: [0, 0, 0, 1, 0] } })
    const gains = extractRollGains(event)
    expect(gains!['RED']).toEqual({ wheat: 1 })
    expect(gains!['RED']).not.toHaveProperty('wood')
  })

  it('returns gains for multiple players', () => {
    const event = makeEvent({ result: { RED: [1, 0, 0, 0, 0], BLUE: [0, 0, 2, 0, 0] } })
    const gains = extractRollGains(event)
    expect(gains!['RED']).toEqual({ wood: 1 })
    expect(gains!['BLUE']).toEqual({ sheep: 2 })
  })

  it('returns null when all players got zero resources', () => {
    const event = makeEvent({ result: { RED: [0, 0, 0, 0, 0] } })
    expect(extractRollGains(event)).toBeNull()
  })

  it('returns null when result is null', () => {
    expect(extractRollGains(makeEvent({ result: null }))).toBeNull()
  })

  it('returns null when result is an array', () => {
    expect(extractRollGains(makeEvent({ result: [3, 4] }))).toBeNull()
  })

  it('returns null when result is a primitive', () => {
    expect(extractRollGains(makeEvent({ result: 7 }))).toBeNull()
  })

  it('skips entries whose freqdeck is not an array', () => {
    const event = makeEvent({ result: { RED: 'invalid', BLUE: [1, 0, 0, 0, 0] } })
    const gains = extractRollGains(event)
    expect(gains).not.toBeNull()
    expect(gains!['RED']).toBeUndefined()
    expect(gains!['BLUE']).toEqual({ wood: 1 })
  })
})

// ── formatActionLogEvent ──────────────────────────────────────────────────────

describe('formatActionLogEvent', () => {
  it('formats ROLL with dice total and individual dice', () => {
    const event = makeEvent({ action_type: 'ROLL', value: [3, 4] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).not.toBeNull()
    expect(html).toContain('ROLL')
    expect(html).toContain('7')
    expect(html).toContain('3')
    expect(html).toContain('4')
  })

  it('formats ROLL with fallback dice when value is missing', () => {
    const event = makeEvent({ action_type: 'ROLL', value: null, result: [5, 2] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('7')
  })

  it('formats ROLL with ? when no dice info available', () => {
    const event = makeEvent({ action_type: 'ROLL', value: null })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('?')
  })

  it('formats BUILD_SETTLEMENT', () => {
    const html = formatActionLogEvent(makeEvent({ action_type: 'BUILD_SETTLEMENT' }), PLAYERS)
    expect(html).toContain('BUILD SETTLEMENT')
  })

  it('formats BUILD_CITY', () => {
    const html = formatActionLogEvent(makeEvent({ action_type: 'BUILD_CITY' }), PLAYERS)
    expect(html).toContain('BUILD CITY')
  })

  it('formats BUILD_ROAD', () => {
    const html = formatActionLogEvent(makeEvent({ action_type: 'BUILD_ROAD' }), PLAYERS)
    expect(html).toContain('BUILD ROAD')
  })

  it('formats PLAY_KNIGHT_CARD', () => {
    const html = formatActionLogEvent(makeEvent({ action_type: 'PLAY_KNIGHT_CARD' }), PLAYERS)
    expect(html).toContain('PLAY KNIGHT')
  })

  it('formats MARITIME_TRADE with rate and resources', () => {
    // 4:1 wood for ore: val = [0, 0, 0, 0, 4] (four wood indices + ore index)
    const event = makeEvent({ action_type: 'MARITIME_TRADE', value: [0, 0, 0, 0, 4] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('TRADE')
    expect(html).toContain('4:1')
  })

  it('formats MARITIME_TRADE fallback when value missing', () => {
    const html = formatActionLogEvent(makeEvent({ action_type: 'MARITIME_TRADE', value: null }), PLAYERS)
    expect(html).toContain('MARITIME TRADE')
  })

  it('formats OFFER_TRADE with offering and asking', () => {
    // offer 2 wood for 1 ore: [2,0,0,0,0, 0,0,0,0,1]
    const event = makeEvent({ action_type: 'OFFER_TRADE', value: [2, 0, 0, 0, 0, 0, 0, 0, 0, 1] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('OFFER')
    expect(html).toContain('🪵')
    expect(html).toContain('⛏️')
  })

  it('formats OFFER_TRADE fallback for short value', () => {
    const html = formatActionLogEvent(makeEvent({ action_type: 'OFFER_TRADE', value: [] }), PLAYERS)
    expect(html).toContain('OFFER TRADE')
  })

  it('formats DISCARD with resources', () => {
    const event = makeEvent({ action_type: 'DISCARD', value: [0, 1] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('DISCARD')
  })

  it('formats PLAY_YEAR_OF_PLENTY with gained resources', () => {
    const event = makeEvent({ action_type: 'PLAY_YEAR_OF_PLENTY', value: [0, 2] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('YEAR OF PLENTY')
  })

  it('formats PLAY_MONOPOLY with resource emoji', () => {
    // resource index 0 = wood
    const event = makeEvent({ action_type: 'PLAY_MONOPOLY', value: 0 })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('MONOPOLY')
  })

  it('formats ACCEPT_TRADE and REJECT_TRADE', () => {
    expect(formatActionLogEvent(makeEvent({ action_type: 'ACCEPT_TRADE' }), PLAYERS)).toContain('ACCEPT TRADE')
    expect(formatActionLogEvent(makeEvent({ action_type: 'REJECT_TRADE' }), PLAYERS)).toContain('REJECT TRADE')
  })

  it('formats CONFIRM_TRADE and CANCEL_TRADE', () => {
    expect(formatActionLogEvent(makeEvent({ action_type: 'CONFIRM_TRADE' }), PLAYERS)).toContain('CONFIRM TRADE')
    expect(formatActionLogEvent(makeEvent({ action_type: 'CANCEL_TRADE' }), PLAYERS)).toContain('CANCEL TRADE')
  })

  it('returns null for END_TURN (suppressed in log)', () => {
    expect(formatActionLogEvent(makeEvent({ action_type: 'END_TURN' }), PLAYERS)).toBeNull()
  })

  it('returns the raw action type for unknown types', () => {
    const event = makeEvent({ action_type: 'UNKNOWN_FUTURE_ACTION' })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).not.toBeNull()
    expect(html).toContain('UNKNOWN_FUTURE_ACTION')
  })

  it('includes the player name in the output', () => {
    const html = formatActionLogEvent(makeEvent({ color: 'RED' }), PLAYERS)
    expect(html).toContain('Alice')
  })

  it('falls back to color when player not in list', () => {
    const html = formatActionLogEvent(makeEvent({ color: 'ORANGE' }), PLAYERS)
    expect(html).toContain('ORANGE')
  })

  it('escapes HTML in player name', () => {
    const players = [makePlayer('RED', '<script>alert(1)</script>')]
    const html = formatActionLogEvent(makeEvent({ color: 'RED' }), players)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('formats MOVE_ROBBER without victim', () => {
    const event = makeEvent({ action_type: 'MOVE_ROBBER', value: ['(0, 0, 0)', null] })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('MOVE ROBBER')
  })

  it('formats MOVE_ROBBER with victim and stolen card', () => {
    const event = makeEvent({
      action_type: 'MOVE_ROBBER',
      value: ['(0, 0, 0)', 'BLUE'],
      card_stolen: true,
      result: 0,
    })
    const html = formatActionLogEvent(event, PLAYERS)
    expect(html).toContain('MOVE ROBBER')
    expect(html).toContain('Bob')
    expect(html).toContain('stole')
  })
})
