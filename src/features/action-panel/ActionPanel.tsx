import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import {
  RESOURCE_EMOJI,
  RESOURCE_ORDER,
  RESOURCE_LABELS,
} from '@/shared/constants';
import type { PlayableAction, ResourceType } from '@/shared/types/game';

interface ActionPanelProps {
  onAction: (action: PlayableAction) => void;
  disabled?: boolean;
}

function ActionButton({
  label,
  emoji,
  onClick,
  disabled,
  variant = 'default',
  active,
  title,
}: {
  label: string;
  emoji?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'ghost';
  active?: boolean;
  title?: string;
}) {
  const variantClasses = {
    default: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500',
    danger: 'bg-red-700 hover:bg-red-600 text-white border-red-600',
    success: 'bg-green-700 hover:bg-green-600 text-white border-green-600',
    ghost: 'bg-transparent hover:bg-slate-700 text-slate-300 border-slate-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium',
        'transition-all duration-150 select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        active && 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900',
      )}
    >
      {emoji && <span>{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}

function DiscardPanel({ onAction, disabled }: ActionPanelProps) {
  const gameState = useGameStore(s => s.gameState);
  const [selected, setSelected] = useState<Partial<Record<ResourceType, number>>>({});

  const currentPlayer = gameState?.players[gameState.current_player_index];
  if (!currentPlayer) return null;

  const totalHand = Object.values(currentPlayer.resources).reduce((a, b) => a + b, 0);
  const required = Math.floor(totalHand / 2);
  const totalSelected = Object.values(selected).reduce((a, b) => a + b, 0);
  const remaining = required - totalSelected;

  const handleIncrement = (res: ResourceType) => {
    const current = selected[res] || 0;
    const inHand = currentPlayer.resources[res];
    if (current < inHand) {
      setSelected(s => ({ ...s, [res]: current + 1 }));
    }
  };

  const handleDecrement = (res: ResourceType) => {
    const current = selected[res] || 0;
    if (current > 0) {
      setSelected(s => ({ ...s, [res]: current - 1 }));
    }
  };

  const handleSubmit = () => {
    const value = RESOURCE_ORDER.map(res => selected[res] || 0);
    onAction({ action_type: 'DISCARD', value });
  };

  return (
    <div className="p-3 bg-red-950/30 border border-red-800/30 rounded-xl space-y-3">
      <div className="text-sm text-red-300 font-semibold">
        Discard {required} cards ({remaining} more to select)
      </div>
      <div className="grid grid-cols-3 gap-2">
        {RESOURCE_ORDER.map(res => {
          const inHand = currentPlayer.resources[res];
          const count = selected[res] || 0;
          if (inHand === 0) return null;
          return (
            <div key={res} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-2 py-1.5">
              <div className="flex items-center gap-1 text-xs">
                <span>{RESOURCE_EMOJI[res]}</span>
                <span className="text-slate-300">{count}/{inHand}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => handleDecrement(res)}
                  disabled={count === 0}
                  className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs disabled:opacity-30"
                >−</button>
                <button
                  onClick={() => handleIncrement(res)}
                  disabled={count >= inHand || totalSelected >= required}
                  className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs disabled:opacity-30"
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || totalSelected !== required}
        className={clsx(
          'w-full py-2 rounded-lg text-sm font-semibold transition-all',
          totalSelected === required
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed',
        )}
      >
        Discard {required} Cards
      </button>
    </div>
  );
}

export default function ActionPanel({ onAction, disabled }: ActionPanelProps) {
  const gameState = useGameStore(s => s.gameState);
  const thinking = useGameStore(s => s.thinking);
  const lastRollDice = useGameStore(s => s.lastRollDice);
  const mode = useInteractionStore(s => s.mode);
  const setMode = useInteractionStore(s => s.setMode);

  const playableActions = gameState?.playable_actions || [];
  const phase = gameState?.game_phase;

  // Categorize actions
  const hasRoll = playableActions.some(a => a.action_type === 'ROLL');
  const hasEndTurn = playableActions.some(a => a.action_type === 'END_TURN');
  const hasBuildRoad = playableActions.some(a => a.action_type === 'BUILD_ROAD');
  const hasBuildSettlement = playableActions.some(a => a.action_type === 'BUILD_SETTLEMENT');
  const hasBuildCity = playableActions.some(a => a.action_type === 'BUILD_CITY');
  const hasBuyDevCard = playableActions.some(a => a.action_type === 'BUY_DEVELOPMENT_CARD');
  const hasPlayKnight = playableActions.some(a => a.action_type === 'PLAY_KNIGHT_CARD');
  const hasPlayYop = playableActions.some(a => a.action_type === 'PLAY_YEAR_OF_PLENTY');
  const hasPlayMonopoly = playableActions.some(a => a.action_type === 'PLAY_MONOPOLY');
  const hasPlayRoadBuilding = playableActions.some(a => a.action_type === 'PLAY_ROAD_BUILDING');
  const hasDiscard = phase === 'DISCARDING';
  const hasMoveRobber = phase === 'MOVING_ROBBER';
  const hasMaritime = playableActions.some(a => a.action_type === 'MARITIME_TRADE');
  const hasAcceptTrade = playableActions.some(a => a.action_type === 'ACCEPT_TRADE');
  const hasRejectTrade = playableActions.some(a => a.action_type === 'REJECT_TRADE');
  const hasConfirmTrade = playableActions.some(a => a.action_type === 'CONFIRM_TRADE');
  const hasCancelTrade = playableActions.some(a => a.action_type === 'CANCEL_TRADE');

  // Auto-activate road mode when road is the only available action (initial build, road building card)
  const roadIsForced = hasBuildRoad && !hasRoll && !hasBuildSettlement && !hasBuildCity && !hasEndTurn && !hasDiscard && !hasMoveRobber;
  useEffect(() => {
    if (roadIsForced && !disabled) {
      setMode('BUILD_ROAD');
    }
  }, [roadIsForced, disabled, setMode]);

  // Thinking indicator
  const isThinking = thinking.phase === 'thinking' || thinking.phase === 'submitting';

  // Year of Plenty state
  const [yopPick, setYopPick] = useState<ResourceType | null>(null);

  const handleYop = (res: ResourceType) => {
    if (!yopPick) {
      setYopPick(res);
    } else {
      onAction({ action_type: 'PLAY_YEAR_OF_PLENTY', value: [RESOURCE_ORDER.indexOf(yopPick), RESOURCE_ORDER.indexOf(res)] });
      setYopPick(null);
    }
  };

  // Maritime trade state
  const [marGiving, setMarGiving] = useState<ResourceType | null>(null);

  // Derive which resources the player can give, and at what rate, from playable actions.
  // Each MARITIME_TRADE value is [...give_indices, receive_index].
  const maritimeGiveRates = useMemo(() => {
    const rates = new Map<ResourceType, number>();
    for (const a of playableActions) {
      if (a.action_type !== 'MARITIME_TRADE' || !Array.isArray(a.value)) continue;
      const val = a.value as (number | null)[];
      const giveIndices = val.slice(0, -1).filter((v): v is number => v !== null);
      if (giveIndices.length === 0) continue;
      const res = RESOURCE_ORDER[giveIndices[0]] as ResourceType;
      if (res && !rates.has(res)) {
        rates.set(res, giveIndices.length);
      }
    }
    return rates;
  }, [playableActions]);

  const handleMaritimeGive = (res: ResourceType) => {
    setMarGiving(res);
  };

  const handleMaritimeReceive = (res: ResourceType) => {
    if (!marGiving) return;
    const action = playableActions.find(a => {
      if (a.action_type !== 'MARITIME_TRADE' || !Array.isArray(a.value)) return false;
      const val = a.value as (number | null)[];
      const givenRes = val.slice(0, -1).filter(v => v !== null);
      const gotten = val[val.length - 1];
      return gotten === RESOURCE_ORDER.indexOf(res) &&
        givenRes.every(v => v === RESOURCE_ORDER.indexOf(marGiving));
    });
    if (action) {
      onAction(action);
    }
    setMarGiving(null);
  };

  // Monopoly state
  const handleMonopoly = (res: ResourceType) => {
    onAction({ action_type: 'PLAY_MONOPOLY', value: RESOURCE_ORDER.indexOf(res) });
  };

  // Trade response
  const handleAcceptTrade = () => {
    const action = playableActions.find(a => a.action_type === 'ACCEPT_TRADE');
    if (action) onAction(action);
  };

  const handleRejectTrade = () => {
    const action = playableActions.find(a => a.action_type === 'REJECT_TRADE');
    if (action) onAction(action);
  };

  if (!gameState) return null;

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Thinking indicator */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-800/60 border border-slate-600/50 rounded-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="thinking-pulse text-sm">🧠</div>
              <span className="text-sm text-slate-300">{thinking.message}</span>
              <span className="ml-auto text-xs text-slate-500">
                {Math.round(thinking.progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                animate={{ width: `${thinking.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discard phase */}
      {hasDiscard && <DiscardPanel onAction={onAction} disabled={disabled} />}

      {/* Move robber instruction */}
      {hasMoveRobber && !hasDiscard && (
        <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/30 rounded-xl p-3">
          🥷 Click a tile to move the robber
        </div>
      )}

      {/* Road placement instruction */}
      {(mode === 'BUILD_ROAD' || roadIsForced) && hasBuildRoad && !disabled && (
        <div className="text-xs text-blue-300 bg-blue-950/30 border border-blue-800/30 rounded-xl p-3">
          🛤️ Click a glowing edge on the board to place your road
        </div>
      )}

      {/* Settlement placement instruction */}
      {mode === 'BUILD_SETTLEMENT' && hasBuildSettlement && !disabled && (
        <div className="text-xs text-green-300 bg-green-950/30 border border-green-800/30 rounded-xl p-3">
          🏠 Click a glowing node on the board to place your settlement
        </div>
      )}

      {/* Trade responses */}
      {(hasAcceptTrade || hasRejectTrade || hasConfirmTrade || hasCancelTrade) && (
        <div className="bg-slate-800/60 border border-slate-600/50 rounded-xl p-3 space-y-2">
          <div className="text-xs text-slate-400 font-semibold">Trade Response</div>
          {gameState.current_trade && (
            <TradeDisplay trade={gameState.current_trade} />
          )}
          <div className="flex gap-2">
            {hasAcceptTrade && (
              <ActionButton label="Accept" emoji="✓" onClick={handleAcceptTrade} variant="success" disabled={disabled} />
            )}
            {hasRejectTrade && (
              <ActionButton label="Reject" emoji="✗" onClick={handleRejectTrade} variant="danger" disabled={disabled} />
            )}
            {hasConfirmTrade && (
              <ActionButton label="Confirm Trade" emoji="🤝" onClick={() => {
                const action = playableActions.find(a => a.action_type === 'CONFIRM_TRADE');
                if (action) onAction(action);
              }} variant="success" disabled={disabled} />
            )}
            {hasCancelTrade && (
              <ActionButton label="Cancel" emoji="✗" onClick={() => {
                const action = playableActions.find(a => a.action_type === 'CANCEL_TRADE');
                if (action) onAction(action);
              }} variant="ghost" disabled={disabled} />
            )}
          </div>
        </div>
      )}

      {/* Dice result — shown after roll, hidden when roll button is available */}
      <AnimatePresence>
        {lastRollDice && !hasRoll && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-3 bg-slate-800/80 border border-slate-600/50 rounded-xl px-4 py-2.5"
          >
            <span className="text-slate-400 text-xs font-medium">Rolled</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-900 font-bold text-base shadow">
                {lastRollDice[0]}
              </span>
              <span className="text-slate-500 text-sm">+</span>
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-900 font-bold text-base shadow">
                {lastRollDice[1]}
              </span>
            </div>
            <span className="text-white font-bold text-lg">= {lastRollDice[0] + lastRollDice[1]}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main actions */}
      <div className="flex flex-wrap gap-2">
        {hasRoll && (
          <ActionButton
            label="Roll Dice"
            emoji="🎲"
            onClick={() => onAction({ action_type: 'ROLL', value: null })}
            variant="primary"
            disabled={disabled}
          />
        )}

        {hasBuildSettlement && (
          <ActionButton
            label="Settlement"
            emoji="🏠"
            onClick={() => setMode(mode === 'BUILD_SETTLEMENT' ? 'IDLE' : 'BUILD_SETTLEMENT')}
            variant="default"
            active={mode === 'BUILD_SETTLEMENT'}
            disabled={disabled}
            title="Click a legal node on the board"
          />
        )}

        {hasBuildCity && (
          <ActionButton
            label="City"
            emoji="🏰"
            onClick={() => setMode(mode === 'BUILD_CITY' ? 'IDLE' : 'BUILD_CITY')}
            variant="default"
            active={mode === 'BUILD_CITY'}
            disabled={disabled}
            title="Click your settlement to upgrade"
          />
        )}

        {hasBuildRoad && (
          <ActionButton
            label="Road"
            emoji="🛤️"
            onClick={() => setMode(mode === 'BUILD_ROAD' ? 'IDLE' : 'BUILD_ROAD')}
            variant="default"
            active={mode === 'BUILD_ROAD'}
            disabled={disabled}
            title="Click a legal edge on the board"
          />
        )}

        {hasBuyDevCard && (
          <ActionButton
            label="Dev Card"
            emoji="📜"
            onClick={() => onAction({ action_type: 'BUY_DEVELOPMENT_CARD', value: null })}
            variant="default"
            disabled={disabled}
          />
        )}
      </div>

      {/* Dev card actions */}
      {(hasPlayKnight || hasPlayYop || hasPlayMonopoly || hasPlayRoadBuilding) && (
        <div className="border-t border-slate-700/50 pt-2">
          <div className="text-xs text-slate-500 mb-1.5">Dev Cards</div>
          <div className="flex flex-wrap gap-1.5">
            {hasPlayKnight && (
              <ActionButton
                label="Knight"
                emoji="⚔️"
                onClick={() => {
                  onAction({ action_type: 'PLAY_KNIGHT_CARD', value: null });
                  setMode('MOVE_ROBBER');
                }}
                variant="ghost"
                disabled={disabled}
              />
            )}
            {hasPlayRoadBuilding && (
              <ActionButton
                label="Road Building"
                emoji="🛤️"
                onClick={() => onAction({ action_type: 'PLAY_ROAD_BUILDING', value: null })}
                variant="ghost"
                disabled={disabled}
              />
            )}
          </div>
        </div>
      )}

      {/* Year of Plenty picker */}
      {hasPlayYop && (
        <div className="border-t border-slate-700/50 pt-2">
          <div className="text-xs text-slate-500 mb-1.5">🎁 Year of Plenty {yopPick ? `— pick 2nd resource (got ${yopPick})` : '— pick 1st resource'}</div>
          <div className="flex flex-wrap gap-1.5">
            {RESOURCE_ORDER.map(res => (
              <button
                key={res}
                onClick={() => handleYop(res)}
                disabled={disabled}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs',
                  'bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-all',
                  yopPick === res && 'ring-2 ring-blue-400',
                )}
              >
                {RESOURCE_EMOJI[res]} {RESOURCE_LABELS[res]}
              </button>
            ))}
            {yopPick && (
              <button onClick={() => setYopPick(null)} className="text-xs text-slate-500 hover:text-slate-300">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Monopoly picker */}
      {hasPlayMonopoly && (
        <div className="border-t border-slate-700/50 pt-2">
          <div className="text-xs text-slate-500 mb-1.5">💰 Monopoly — pick resource</div>
          <div className="flex flex-wrap gap-1.5">
            {RESOURCE_ORDER.map(res => (
              <button
                key={res}
                onClick={() => handleMonopoly(res)}
                disabled={disabled}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-all"
              >
                {RESOURCE_EMOJI[res]} {RESOURCE_LABELS[res]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Maritime trade */}
      {hasMaritime && (
        <div className="border-t border-slate-700/50 pt-2">
          <div className="text-xs text-slate-500 mb-1.5">
            ⚓ Maritime Trade {marGiving ? `— pick resource to receive (giving ${marGiving})` : '— pick resource to give'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RESOURCE_ORDER.map(res => {
              if (!marGiving) {
                // Step 1: only show resources that appear in a valid MARITIME_TRADE action
                const rate = maritimeGiveRates.get(res as ResourceType);
                if (!rate) return null;
                return (
                  <button
                    key={res}
                    onClick={() => handleMaritimeGive(res as ResourceType)}
                    disabled={disabled}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-all"
                  >
                    {RESOURCE_EMOJI[res as ResourceType]} {RESOURCE_LABELS[res as ResourceType]}
                    <span className="text-slate-400">{rate}:1</span>
                  </button>
                );
              }
              // Step 2: show all resources as receive options
              return (
                <button
                  key={res}
                  onClick={() => handleMaritimeReceive(res as ResourceType)}
                  disabled={disabled || res === marGiving}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs',
                    'bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-all',
                    res === marGiving && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {RESOURCE_EMOJI[res as ResourceType]} {RESOURCE_LABELS[res as ResourceType]}
                </button>
              );
            })}
            {marGiving && (
              <button onClick={() => setMarGiving(null)} className="text-xs text-slate-500 hover:text-slate-300">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* End turn */}
      {hasEndTurn && (
        <div className="mt-auto pt-2 border-t border-slate-700/50">
          <ActionButton
            label="End Turn"
            emoji="⏭️"
            onClick={() => onAction({ action_type: 'END_TURN', value: null })}
            variant="primary"
            disabled={disabled}
          />
        </div>
      )}

      {/* No actions available */}
      {playableActions.length === 0 && !isThinking && !hasDiscard && !hasMoveRobber && (
        <div className="text-xs text-slate-600 text-center py-2">
          Waiting for other players...
        </div>
      )}
    </div>
  );
}

function TradeDisplay({ trade }: { trade: number[] }) {
  const offer = trade.slice(0, 5);
  const ask = trade.slice(5, 10);

  return (
    <div className="flex items-center gap-3 text-xs text-slate-300">
      <div className="flex gap-1">
        {RESOURCE_ORDER.map((res, i) => offer[i] > 0 && (
          <span key={res} className="bg-green-900/40 px-1 rounded">
            {RESOURCE_EMOJI[res]}×{offer[i]}
          </span>
        ))}
      </div>
      <span className="text-slate-500">↔</span>
      <div className="flex gap-1">
        {RESOURCE_ORDER.map((res, i) => ask[i] > 0 && (
          <span key={res} className="bg-blue-900/40 px-1 rounded">
            {RESOURCE_EMOJI[res]}×{ask[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
