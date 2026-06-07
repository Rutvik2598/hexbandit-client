import type { Player, ActionLogEvent } from '@/shared/types/game';
import { RESOURCE_ORDER } from '@/shared/constants';

export interface PlayerGameStats {
  color: string;
  name: string;
  // Buildings
  roadsBuilt: number;
  settlementsOnBoard: number;
  citiesOnBoard: number;
  // Army
  knightsPlayed: number;
  longestRoadLength: number;
  // Dev cards played breakdown
  devKnight: number;
  devYop: number;
  devMonopoly: number;
  devRoadBuilding: number;
  devTotalPlayed: number;
  // Economy
  finalResources: number;
  finalDevCards: number;
  // From action log (optional — only populated when log available)
  resourcesCollected: number;
  tradesCompleted: number;
  timesRobbed: number;
  timesRobbing: number;
}

/** Derive per-player stats from the final game state players array. */
export function computePlayerStats(players: Player[]): PlayerGameStats[] {
  return players.map(p => {
    const played = p.dev_cards_played ?? { knight: 0, year_of_plenty: 0, monopoly: 0, road_building: 0, victory_point: 0 };
    const finalRes = RESOURCE_ORDER.reduce((sum, r) => sum + (p.resources[r] ?? 0), 0);

    return {
      color: p.color,
      name: p.name,
      roadsBuilt: p.roads_built,
      settlementsOnBoard: p.settlements,
      citiesOnBoard: p.cities,
      knightsPlayed: p.knights_played,
      longestRoadLength: p.longest_road_length ?? 0,
      devKnight: played.knight,
      devYop: played.year_of_plenty,
      devMonopoly: played.monopoly,
      devRoadBuilding: played.road_building,
      devTotalPlayed: played.knight + played.year_of_plenty + played.monopoly + played.road_building,
      finalResources: finalRes,
      finalDevCards: p.num_dev_cards,
      resourcesCollected: 0,
      tradesCompleted: 0,
      timesRobbed: 0,
      timesRobbing: 0,
    };
  });
}

export function enrichWithActionLog(
  stats: PlayerGameStats[],
  actionLog: ActionLogEvent[],
): PlayerGameStats[] {
  const byColor = new Map(stats.map(s => [s.color, { ...s }]));

  for (const event of actionLog) {
    const s = byColor.get(event.color);
    if (!s) continue;

    switch (event.action_type) {
      case 'ROLL': {
        const result = event.result;
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          for (const [color, freqdeck] of Object.entries(result as Record<string, unknown>)) {
            const ps = byColor.get(color);
            if (ps && Array.isArray(freqdeck)) {
              ps.resourcesCollected += (freqdeck as number[]).reduce((a, b) => a + b, 0);
            }
          }
        }
        break;
      }
      case 'CONFIRM_TRADE':
        s.tradesCompleted++;
        break;
      case 'MOVE_ROBBER': {
        if (event.card_stolen) {
          s.timesRobbing++;
          const val = event.value;
          if (Array.isArray(val) && val[1]) {
            const victim = byColor.get(String(val[1]));
            if (victim) victim.timesRobbed++;
          }
        }
        break;
      }
    }
  }

  return Array.from(byColor.values());
}
