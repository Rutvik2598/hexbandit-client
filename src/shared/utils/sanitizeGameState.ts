import type { GameState, Player, DevCardCounts } from '@/shared/types/game';

const ZERO_DEV_CARDS: DevCardCounts = {
  knight: 0,
  year_of_plenty: 0,
  monopoly: 0,
  road_building: 0,
  victory_point: 0,
};

function redactPlayer(player: Player): Player {
  return {
    ...player,
    dev_cards_private: ZERO_DEV_CARDS,
    dev_cards_owned_at_start_private: undefined,
  };
}

/**
 * Strips private opponent information before the state is stored in memory.
 * Prevents players from reading opponent dev cards via DevTools or the
 * Zustand store. Uses agent_id === 'human' from the response itself so it
 * works on the very first fetch before humanPlayerIndices are known.
 *
 * All-bot (spectator) games are left untouched — no human player is present
 * so there is no private perspective to enforce.
 */
export function sanitizeGameState(state: GameState): GameState {
  const humanColors = new Set(
    state.players.filter(p => p.agent_id === 'human').map(p => p.color),
  );

  if (humanColors.size === 0) {
    return state;
  }

  return {
    ...state,
    // Deck composition is always private — opponents must not know what
    // cards remain in the development card deck.
    dev_deck_private: undefined,
    players: state.players.map(p =>
      humanColors.has(p.color) ? p : redactPlayer(p),
    ),
  };
}
