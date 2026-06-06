import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import { useUiStore } from '@/store/uiStore';
import type { PlayableAction } from '@/shared/types/game';

interface Options {
  onAction: (action: PlayableAction) => void;
}

/** Returns true when the user is typing in a form element. */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/**
 * Global keyboard shortcuts for the game page.
 *
 * Shortcuts (human turn only, skipped while typing):
 *   R          — toggle Build Road mode
 *   S          — toggle Build Settlement mode
 *   C          — toggle Build City mode
 *   K          — play Knight card (when available)
 *   T          — open Offer Trade modal (after rolling)
 *   Enter      — Roll Dice · or · End Turn
 *   Escape     — cancel current build mode / close open modals
 */
export function useKeyboardShortcuts({ onAction }: Options) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Never fire when the user is typing or using modifier combos.
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const interaction = useInteractionStore.getState();
      const ui = useUiStore.getState();

      // ── Escape: cancel mode first, then close modals in priority order ──────
      if (e.key === 'Escape') {
        if (ui.showSettings) {
          e.preventDefault();
          ui.setShowSettings(false);
          return;
        }
        if (interaction.mode !== 'IDLE') {
          e.preventDefault();
          interaction.setMode('IDLE');
          return;
        }
        if (ui.showOfferTradeModal) {
          e.preventDefault();
          ui.setShowOfferTradeModal(false);
          return;
        }
        if (ui.showTradeModal) {
          e.preventDefault();
          ui.setShowTradeModal(false);
          return;
        }
        return;
      }

      // ── All other shortcuts require an active human turn ──────────────────
      const s = useGameStore.getState();
      if (!s.gameState || s.replayMode) return;
      const isHumanTurn = s.humanPlayerIndices.includes(s.gameState.current_player_index);
      if (!isHumanTurn) return;

      const actions = s.gameState.playable_actions ?? [];
      const hasRoll           = actions.some(a => a.action_type === 'ROLL');
      const hasEndTurn        = actions.some(a => a.action_type === 'END_TURN');
      const hasBuildRoad      = actions.some(a => a.action_type === 'BUILD_ROAD');
      const hasBuildSettlement= actions.some(a => a.action_type === 'BUILD_SETTLEMENT');
      const hasBuildCity      = actions.some(a => a.action_type === 'BUILD_CITY');
      const knightAction      = actions.find(a => a.action_type === 'PLAY_KNIGHT_CARD');
      const tradeAllowed      = !!s.gameState.is_trade_allowed && !hasRoll;

      const key = e.key.toLowerCase();

      switch (key) {
        case 'enter': {
          if (hasRoll) {
            e.preventDefault();
            onAction({ action_type: 'ROLL', value: null });
          } else if (hasEndTurn) {
            e.preventDefault();
            onAction({ action_type: 'END_TURN', value: null });
          }
          break;
        }
        case 'r': {
          if (hasBuildRoad) {
            e.preventDefault();
            interaction.setMode(interaction.mode === 'BUILD_ROAD' ? 'IDLE' : 'BUILD_ROAD');
          }
          break;
        }
        case 's': {
          if (hasBuildSettlement) {
            e.preventDefault();
            interaction.setMode(interaction.mode === 'BUILD_SETTLEMENT' ? 'IDLE' : 'BUILD_SETTLEMENT');
          }
          break;
        }
        case 'c': {
          if (hasBuildCity) {
            e.preventDefault();
            interaction.setMode(interaction.mode === 'BUILD_CITY' ? 'IDLE' : 'BUILD_CITY');
          }
          break;
        }
        case 'k': {
          if (knightAction) {
            e.preventDefault();
            onAction(knightAction);
          }
          break;
        }
        case 't': {
          if (tradeAllowed) {
            e.preventDefault();
            ui.setShowOfferTradeModal(!ui.showOfferTradeModal);
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onAction]);
}
