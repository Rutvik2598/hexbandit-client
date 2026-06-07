import { describe, it, expect } from 'vitest'
import { computePlayerStats, enrichWithActionLog } from './computeGameStats'
import type { Player, ActionLogEvent } from '@/shared/types/game'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    index: 0,
    color: 'RED',
    name: 'Alice',
    victory_points: 2,
    resources: { wood: 1, brick: 0, sheep: 2, wheat: 1, ore: 0 },
    settlements: 2,
    cities: 0,
    roads_built: 3,
    has_longest_road: false,
    has_largest_army: false,
    longest_road_length: 3,
    knights_played: 1,
    num_dev_cards: 1,
    dev_cards_private: { knight: 0, year_of_plenty: 0, monopoly: 0, road_building: 0, victory_point: 1 },
    dev_cards_played: { knight: 1, year_of_plenty: 1, monopoly: 0, road_building: 1, victory_point: 0 },
    port_resources: [],
    ...overrides,
  }
}

// ── computePlayerStats ───────────────────────────────────────────────────────

describe('computePlayerStats', () => {
  it('maps color and name', () => {
    const [stats] = computePlayerStats([makePlayer()])
    expect(stats.color).toBe('RED')
    expect(stats.name).toBe('Alice')
  })

  it('maps building counts', () => {
    const [stats] = computePlayerStats([makePlayer({ settlements: 3, cities: 1, roads_built: 5 })])
    expect(stats.settlementsOnBoard).toBe(3)
    expect(stats.citiesOnBoard).toBe(1)
    expect(stats.roadsBuilt).toBe(5)
  })

  it('maps army stats', () => {
    const [stats] = computePlayerStats([makePlayer({ knights_played: 4, longest_road_length: 7 })])
    expect(stats.knightsPlayed).toBe(4)
    expect(stats.longestRoadLength).toBe(7)
  })

  it('sums dev cards played correctly', () => {
    const [stats] = computePlayerStats([makePlayer()])
    // knight: 1, yop: 1, road_building: 1, monopoly: 0, vp: 0
    expect(stats.devKnight).toBe(1)
    expect(stats.devYop).toBe(1)
    expect(stats.devRoadBuilding).toBe(1)
    expect(stats.devMonopoly).toBe(0)
    expect(stats.devTotalPlayed).toBe(3)
  })

  it('sums final resources across all 5 types', () => {
    const [stats] = computePlayerStats([
      makePlayer({ resources: { wood: 2, brick: 1, sheep: 0, wheat: 3, ore: 1 } }),
    ])
    expect(stats.finalResources).toBe(7)
  })

  it('handles missing dev_cards_played gracefully (defaults to 0)', () => {
    const player = makePlayer()
    // @ts-expect-error — simulating missing field from server
    delete player.dev_cards_played
    const [stats] = computePlayerStats([player])
    expect(stats.devKnight).toBe(0)
    expect(stats.devTotalPlayed).toBe(0)
  })

  it('initializes action-log fields to 0', () => {
    const [stats] = computePlayerStats([makePlayer()])
    expect(stats.resourcesCollected).toBe(0)
    expect(stats.tradesCompleted).toBe(0)
    expect(stats.timesRobbed).toBe(0)
    expect(stats.timesRobbing).toBe(0)
  })

  it('handles multiple players independently', () => {
    const red = makePlayer({ color: 'RED', name: 'Alice', settlements: 2 })
    const blue = makePlayer({ color: 'BLUE', name: 'Bob', settlements: 3 })
    const stats = computePlayerStats([red, blue])
    expect(stats).toHaveLength(2)
    expect(stats[0].color).toBe('RED')
    expect(stats[1].color).toBe('BLUE')
    expect(stats[0].settlementsOnBoard).toBe(2)
    expect(stats[1].settlementsOnBoard).toBe(3)
  })
})

// ── enrichWithActionLog ───────────────────────────────────────────────────────

function makeRollEvent(color: string, gains: Record<string, number[]>): ActionLogEvent {
  return { action_type: 'ROLL', color, value: [3, 4], result: gains }
}

function makeTradeEvent(color: string): ActionLogEvent {
  return { action_type: 'CONFIRM_TRADE', color, value: null }
}

function makeRobberEvent(color: string, victim: string, stolen: boolean): ActionLogEvent {
  return { action_type: 'MOVE_ROBBER', color, value: ['(0, 0, 0)', victim], card_stolen: stolen }
}

describe('enrichWithActionLog', () => {
  it('increments resourcesCollected from ROLL gains', () => {
    const base = computePlayerStats([makePlayer({ color: 'RED' })])
    const log: ActionLogEvent[] = [
      makeRollEvent('RED', { RED: [2, 1, 0, 0, 0] }), // 3 resources
    ]
    const [stats] = enrichWithActionLog(base, log)
    expect(stats.resourcesCollected).toBe(3)
  })

  it('accumulates resourcesCollected across multiple ROLL events', () => {
    const base = computePlayerStats([makePlayer({ color: 'RED' })])
    const log: ActionLogEvent[] = [
      makeRollEvent('RED', { RED: [1, 0, 0, 0, 0] }),
      makeRollEvent('RED', { RED: [0, 0, 2, 1, 0] }),
    ]
    const [stats] = enrichWithActionLog(base, log)
    expect(stats.resourcesCollected).toBe(4)
  })

  it('tracks resourcesCollected per color from shared ROLL event', () => {
    const base = computePlayerStats([
      makePlayer({ color: 'RED' }),
      makePlayer({ color: 'BLUE', name: 'Bob' }),
    ])
    const log: ActionLogEvent[] = [
      makeRollEvent('RED', { RED: [2, 0, 0, 0, 0], BLUE: [0, 0, 1, 0, 0] }),
    ]
    const enriched = enrichWithActionLog(base, log)
    const red = enriched.find(s => s.color === 'RED')!
    const blue = enriched.find(s => s.color === 'BLUE')!
    expect(red.resourcesCollected).toBe(2)
    expect(blue.resourcesCollected).toBe(1)
  })

  it('increments tradesCompleted on CONFIRM_TRADE', () => {
    const base = computePlayerStats([makePlayer({ color: 'RED' })])
    const log: ActionLogEvent[] = [makeTradeEvent('RED'), makeTradeEvent('RED')]
    const [stats] = enrichWithActionLog(base, log)
    expect(stats.tradesCompleted).toBe(2)
  })

  it('increments timesRobbing for attacker and timesRobbed for victim', () => {
    const base = computePlayerStats([
      makePlayer({ color: 'RED' }),
      makePlayer({ color: 'BLUE', name: 'Bob' }),
    ])
    const log: ActionLogEvent[] = [makeRobberEvent('RED', 'BLUE', true)]
    const enriched = enrichWithActionLog(base, log)
    const red = enriched.find(s => s.color === 'RED')!
    const blue = enriched.find(s => s.color === 'BLUE')!
    expect(red.timesRobbing).toBe(1)
    expect(blue.timesRobbed).toBe(1)
  })

  it('does not increment timesRobbing when no card was stolen', () => {
    const base = computePlayerStats([makePlayer({ color: 'RED' })])
    const log: ActionLogEvent[] = [makeRobberEvent('RED', 'BLUE', false)]
    const [stats] = enrichWithActionLog(base, log)
    expect(stats.timesRobbing).toBe(0)
  })

  it('ignores events for unknown colors', () => {
    const base = computePlayerStats([makePlayer({ color: 'RED' })])
    const log: ActionLogEvent[] = [makeTradeEvent('GREEN')]
    const [stats] = enrichWithActionLog(base, log)
    expect(stats.tradesCompleted).toBe(0)
  })

  it('does not mutate original stats array', () => {
    const base = computePlayerStats([makePlayer({ color: 'RED' })])
    const originalTrades = base[0].tradesCompleted
    enrichWithActionLog(base, [makeTradeEvent('RED')])
    expect(base[0].tradesCompleted).toBe(originalTrades)
  })
})
