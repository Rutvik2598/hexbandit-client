import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import { DiceTray } from '@/features/dice/DiceTray';
import { ResourceIcon } from '@/shared/components/ResourceIcon';
import { Icon } from '@/shared/components/Icon';
import {
  RESOURCE_ORDER,
  RESOURCE_LABELS,
  PLAYER_COLORS,
} from '@/shared/constants';
import type { PlayableAction, PlayerColor, ResourceType } from '@/shared/types/game';

// ---- build cost catalogue -----------------------------------------------

const BUILD_COSTS: Record<string, Partial<Record<ResourceType, number>>> = {
  road:       { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city:       { wheat: 2, ore: 3 },
  devcard:    { sheep: 1, wheat: 1, ore: 1 },
};


function canAfford(resources: Record<string, number>, cost: Partial<Record<string, number>>) {
  return Object.entries(cost).every(([k, v]) => (resources[k] ?? 0) >= (v ?? 0));
}

// ---- sub-components -------------------------------------------------------

interface BuildButtonProps {
  label: string;
  iconName: 'road' | 'settlement' | 'city' | 'devcard';
  cost: Partial<Record<ResourceType, number>>;
  resources: Record<string, number>;
  rolled: boolean;
  isMyTurn: boolean;
  available: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function BuildButton({ label, iconName, cost, resources, rolled, isMyTurn, available, active, disabled, onClick }: BuildButtonProps) {
  const [hover, setHover] = useState(false);
  const afford   = canAfford(resources, cost);
  // Fully actionable: resources, rolled, your turn, server allows it (legal spots + piece limit)
  const canBuild = afford && rolled && isMyTurn && available;
  const ready    = canBuild && !disabled;

  const bg = hover && ready
    ? 'var(--bg-3)'
    : canBuild
    ? 'var(--glass-2)'
    : 'rgba(255,255,255,0.025)';

  // Three opacity levels: ready, can-afford-but-blocked, can't-afford
  const opacity = canBuild ? 1 : (afford && isMyTurn ? 0.5 : 0.35);

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => ready && onClick()}
      disabled={!ready}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '8px 10px', borderRadius: 11,
        background: active ? 'var(--glass-hi)' : bg,
        border: `1px solid ${active ? 'var(--sapphire-bright)' : canBuild ? 'var(--glass-brd2)' : 'var(--hairline)'}`,
        color: afford ? 'var(--text)' : 'var(--text-faint)',
        textAlign: 'left', cursor: ready ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s, transform 0.12s',
        transform: hover && ready ? 'translateY(-1px)' : 'none',
        opacity,
        outline: active ? '2px solid var(--sapphire-bright)' : 'none',
        outlineOffset: 1,
      }}
    >
      {/* icon box */}
      <span style={{
        width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0,
        background: afford ? 'color-mix(in srgb, var(--sapphire) 20%, transparent)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${afford ? 'var(--sapphire)' : 'var(--hairline)'}`,
      }}>
        <Icon name={iconName} size={16} color={afford ? 'var(--sapphire-bright)' : 'var(--text-faint)'} />
      </span>

      {/* label + cost chips */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.01em' }}>{label}</span>
        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {Object.entries(cost).map(([k, v]) => {
            const has = (resources[k] ?? 0) >= (v ?? 0);
            return (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: has ? 1 : 0.5 }}>
                <ResourceIcon type={k} size={12} shadow={false} />
                <span style={{ fontSize: 10, fontWeight: 800, color: has ? 'var(--text-dim)' : 'var(--p-red)' }}>{v}</span>
              </span>
            );
          })}
        </span>
      </span>

      {/* amber dot — only when the action is fully ready */}
      {canBuild && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: 'var(--amber)',
          boxShadow: '0 0 8px var(--amber-glow)',
        }} />
      )}
    </button>
  );
}

// ---- DiscardPanel --------------------------------------------------------

function DiscardPanel({ onAction, disabled }: { onAction: (_: PlayableAction) => void; disabled?: boolean }) {
  const gameState = useGameStore(s => s.gameState);
  const [selected, setSelected] = useState<Partial<Record<ResourceType, number>>>({});

  const player = gameState?.players[gameState.current_player_index];
  if (!player) return null;

  const total    = Object.values(player.resources).reduce((a, b) => a + b, 0);
  const required = Math.floor(total / 2);
  const chosen   = Object.values(selected).reduce((a, b) => a + b, 0);
  const remaining = required - chosen;
  const done = chosen === required;

  const inc = (res: ResourceType) => {
    if ((selected[res] ?? 0) < player.resources[res] && chosen < required)
      setSelected(s => ({ ...s, [res]: (s[res] ?? 0) + 1 }));
  };
  const dec = (res: ResourceType) => {
    if ((selected[res] ?? 0) > 0)
      setSelected(s => ({ ...s, [res]: (s[res] ?? 0) - 1 }));
  };

  return (
    <div className="panel" style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--p-red)' }}>
          Discard {required}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
          background: done ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
          color: done ? '#4ade80' : '#f87171',
          border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
        }}>
          {done ? '✓ Ready' : `${remaining} left`}
        </span>
      </div>

      {/* resource rows — single column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {RESOURCE_ORDER.map(res => {
          const inHand = player.resources[res];
          if (inHand === 0) return null;
          const count = selected[res] ?? 0;
          const canInc = count < inHand && chosen < required;
          const canDec = count > 0;

          return (
            <div key={res} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 8px', borderRadius: 9,
              background: count > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${count > 0 ? 'rgba(239,68,68,0.3)' : 'var(--hairline)'}`,
              transition: 'all 0.15s',
            }}>
              <ResourceIcon type={res} size={16} shadow={false} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', flex: 1 }}>
                {RESOURCE_LABELS[res]}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', minWidth: 28, textAlign: 'right' }}>
                {count > 0 ? <span style={{ color: '#f87171' }}>{count}</span> : null}
                <span style={{ color: 'var(--text-ghost)' }}>/{inHand}</span>
              </span>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <button
                  onClick={() => dec(res)} disabled={!canDec}
                  style={{
                    width: 22, height: 22, borderRadius: 6, fontSize: 14, lineHeight: 1,
                    background: canDec ? 'var(--glass-hi)' : 'transparent',
                    border: `1px solid ${canDec ? 'var(--glass-brd2)' : 'var(--hairline)'}`,
                    color: canDec ? 'var(--text)' : 'var(--text-ghost)',
                    cursor: canDec ? 'pointer' : 'not-allowed',
                    display: 'grid', placeItems: 'center',
                  }}
                >−</button>
                <button
                  onClick={() => inc(res)} disabled={!canInc}
                  style={{
                    width: 22, height: 22, borderRadius: 6, fontSize: 14, lineHeight: 1,
                    background: canInc ? 'var(--glass-hi)' : 'transparent',
                    border: `1px solid ${canInc ? 'var(--glass-brd2)' : 'var(--hairline)'}`,
                    color: canInc ? 'var(--text)' : 'var(--text-ghost)',
                    cursor: canInc ? 'pointer' : 'not-allowed',
                    display: 'grid', placeItems: 'center',
                  }}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* confirm button */}
      <button
        onClick={() => onAction({ action_type: 'DISCARD', value: RESOURCE_ORDER.map(r => selected[r] ?? 0) })}
        disabled={disabled || !done}
        className={`btn${done ? ' btn-primary' : ''}`}
        style={{ padding: '9px 0', fontSize: 12.5, fontWeight: 800, width: '100%', opacity: done ? 1 : 0.45 }}
      >
        Discard {required} Cards
      </button>
    </div>
  );
}


// ---- TradeRow — a labelled resource list used in trade panels ---------------

function TradeRow({ label, accent, items }: {
  label: string;
  accent: string;
  items: { r: ResourceType; n: number }[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: accent,
      }}>{label}</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {items.length > 0 ? items.map(({ r, n }) => (
          <span key={r} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px 4px 5px', borderRadius: 7,
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hairline)',
          }}>
            <ResourceIcon type={r} size={16} shadow={false} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: accent }}>{n}</span>
          </span>
        )) : (
          <span style={{ fontSize: 11, color: 'var(--text-ghost)', fontStyle: 'italic' }}>nothing</span>
        )}
      </div>
    </div>
  );
}

// ---- TradeResponse — accept/reject/cancel for non-offerers ----------------

function TradeResponse({ onAction, disabled, actions, trade, players, offererIdx }: {
  onAction: (_: PlayableAction) => void;
  disabled?: boolean;
  actions: PlayableAction[];
  trade: number[];
  players: Array<{ name: string; color: string }>;
  offererIdx: number;
}) {
  const hasAccept = actions.some(a => a.action_type === 'ACCEPT_TRADE');
  const hasReject = actions.some(a => a.action_type === 'REJECT_TRADE');
  const hasCancel = actions.some(a => a.action_type === 'CANCEL_TRADE');

  const act = (type: string) => {
    const a = actions.find(x => x.action_type === type);
    if (a) onAction(a);
  };

  const offerer = players[offererIdx];
  const offererColor = offerer ? (PLAYER_COLORS[offerer.color as PlayerColor] || '#ccc') : '#ccc';

  // From the RECEIVER's perspective:
  //   trade[0..4] = what offerer gives  → YOU GET
  //   trade[5..9] = what offerer wants  → YOU GIVE
  const youGive = RESOURCE_ORDER.map((r, i) => ({ r, n: trade[i + 5] ?? 0 })).filter(x => x.n > 0);
  const youGet  = RESOURCE_ORDER.map((r, i) => ({ r, n: trade[i]     ?? 0 })).filter(x => x.n > 0);

  return (
    <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: offererColor, boxShadow: `0 0 8px ${offererColor}`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
          {offerer?.name ?? 'Player'} wants to trade
        </span>
      </div>

      {/* you give / you get breakdown */}
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--hairline)',
      }}>
        <div style={{ padding: '10px 12px', background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid var(--hairline)' }}>
          <TradeRow label="You Give" accent="#f87171" items={youGive} />
        </div>
        <div style={{ padding: '10px 12px', background: 'rgba(74,222,128,0.06)' }}>
          <TradeRow label="You Get" accent="#4ade80" items={youGet} />
        </div>
      </div>

      {/* action buttons */}
      <div style={{ display: 'flex', gap: 7 }}>
        {hasAccept && (
          <button onClick={() => act('ACCEPT_TRADE')} disabled={disabled}
            className="btn btn-primary" style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 800 }}>
            ✓ Accept
          </button>
        )}
        {hasReject && (
          <button onClick={() => act('REJECT_TRADE')} disabled={disabled}
            className="btn" style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 800, borderColor: 'rgba(220,60,60,0.4)', color: '#f87171' }}>
            ✗ Reject
          </button>
        )}
        {hasCancel && (
          <button onClick={() => act('CANCEL_TRADE')} disabled={disabled}
            className="btn" style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 800 }}>
            ✗ Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ---- DecideAccepteesPanel — offerer picks who to confirm with --------------

function DecideAccepteesPanel({ onAction, disabled, actions, trade, players }: {
  onAction: (_: PlayableAction) => void;
  disabled?: boolean;
  actions: PlayableAction[];
  trade: number[];
  players: Array<{ name: string; color: string }>;
}) {
  const confirmActions = actions.filter(a => a.action_type === 'CONFIRM_TRADE');
  const hasCancel = actions.some(a => a.action_type === 'CANCEL_TRADE');

  const act = (type: string) => {
    const a = actions.find(x => x.action_type === type);
    if (a) onAction(a);
  };

  // From the OFFERER's perspective:
  //   trade[0..4] = what you give
  //   trade[5..9] = what you get
  const youGive = RESOURCE_ORDER.map((r, i) => ({ r, n: trade[i]     ?? 0 })).filter(x => x.n > 0);
  const youGet  = RESOURCE_ORDER.map((r, i) => ({ r, n: trade[i + 5] ?? 0 })).filter(x => x.n > 0);

  return (
    <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="eyebrow">Choose Trade Partner</div>

      {/* trade summary for the offerer */}
      {trade.length >= 10 && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--hairline)' }}>
          <div style={{ padding: '8px 12px', background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid var(--hairline)' }}>
            <TradeRow label="You Give" accent="#f87171" items={youGive} />
          </div>
          <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.06)' }}>
            <TradeRow label="You Get" accent="#4ade80" items={youGet} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-dim)' }}>
        These players accepted — pick one to trade with:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {confirmActions.map((action) => {
          const val = Array.isArray(action.value) ? action.value as (string | number)[] : [];
          const counterpartyColor = val[val.length - 1] as string;
          const counterparty = players.find(p => p.color === counterpartyColor);
          const hex = PLAYER_COLORS[counterpartyColor as PlayerColor] || '#ccc';
          return (
            <button
              key={counterpartyColor}
              onClick={() => !disabled && onAction(action)}
              disabled={disabled}
              className="btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 12px', textAlign: 'left',
                borderColor: hex, background: `color-mix(in srgb, ${hex} 10%, rgba(255,255,255,0.03))`,
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: hex, boxShadow: `0 0 8px ${hex}`,
              }} />
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
                {counterparty?.name ?? counterpartyColor}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--amber-soft)', fontWeight: 700 }}>
                Confirm →
              </span>
            </button>
          );
        })}
      </div>
      {hasCancel && (
        <button onClick={() => act('CANCEL_TRADE')} disabled={disabled}
          className="btn" style={{ padding: '8px 0', fontSize: 12, fontWeight: 700, width: '100%' }}>
          Cancel Trade
        </button>
      )}
    </div>
  );
}

// ---- Main ActionPanel ----------------------------------------------------

export interface ActionPanelProps {
  onAction: (_: PlayableAction) => void;
  disabled?: boolean;
  width?: number | string;
  /** On desktop, render trade-response / decide-acceptees as a centred modal
   *  instead of inline in the bottom-left panel. */
  floatTrade?: boolean;
}

export default function ActionPanel({ onAction, disabled, width = 190, floatTrade = false }: ActionPanelProps) {
  const gameState     = useGameStore(s => s.gameState);
  const thinking      = useGameStore(s => s.thinking);
  const lastRollDice  = useGameStore(s => s.lastRollDice);
  const humanIndices  = useGameStore(s => s.humanPlayerIndices);
  const mode          = useInteractionStore(s => s.mode);
  const setMode       = useInteractionStore(s => s.setMode);

  const [rollPending, setRollPending] = useState(false);
  const [rollKey, setRollKey]         = useState(0);
  const prevDice = useRef<typeof lastRollDice>(lastRollDice);

  const playableActions = gameState?.playable_actions ?? [];
  const phase = gameState?.game_phase;
  const isHumanTurn    = humanIndices.includes(gameState?.current_player_index ?? -1);
  const currentPlayer  = gameState?.players[gameState.current_player_index];
  const humanPlayer    = gameState?.players[humanIndices[0] ?? -1];
  const resources      = humanPlayer?.resources ?? {};

  const hasRoll       = playableActions.some(a => a.action_type === 'ROLL');
  const hasEndTurn    = playableActions.some(a => a.action_type === 'END_TURN');
  const hasBuildRoad  = playableActions.some(a => a.action_type === 'BUILD_ROAD');
  const hasBuildSettlement = playableActions.some(a => a.action_type === 'BUILD_SETTLEMENT');
  const hasBuildCity  = playableActions.some(a => a.action_type === 'BUILD_CITY');
  const hasBuyDev     = playableActions.some(a => a.action_type === 'BUY_DEVELOPMENT_CARD');
  const hasDiscard    = phase === 'DISCARDING';
  const hasMoveRobber = phase === 'MOVING_ROBBER';
  const isDecideAcceptees = phase === 'DECIDE_ACCEPTEES';
  const hasTradeResponse = !isDecideAcceptees && playableActions.some(a =>
    a.action_type === 'ACCEPT_TRADE' || a.action_type === 'REJECT_TRADE' ||
    a.action_type === 'CANCEL_TRADE');
  const isOfferTradeAllowed = !!(gameState?.is_trade_allowed) && isHumanTurn && !disabled;

  const currentTrade = gameState?.current_trade ?? [];
  const offererIdx   = currentTrade[10] ?? 0;
  const playersList  = (gameState?.players ?? []).map(p => ({ name: p.name, color: p.color }));

  const rolled = !hasRoll && !!lastRollDice;

  // END_TURN may still appear during Road Building (forfeit), so we can't gate on !hasEndTurn.
  const roadIsForced        = hasBuildRoad && !hasRoll && !hasBuildSettlement && !hasBuildCity && !hasEndTurn && !hasDiscard && !hasMoveRobber;
  const isRoadBuildingPhase = phase === 'ROAD_BUILDING' && hasBuildRoad && isHumanTurn;
  useEffect(() => {
    if ((roadIsForced || isRoadBuildingPhase) && !disabled) setMode('BUILD_ROAD');
  }, [roadIsForced, isRoadBuildingPhase, disabled, setMode]);

  const handleRoll = () => {
    setRollPending(true);
    setRollKey(k => k + 1);
    onAction({ action_type: 'ROLL', value: null });
  };
  useEffect(() => {
    if (!rollPending) {
      // Keep prevDice in sync even when bots roll (rollPending is not set for them).
      prevDice.current = lastRollDice;
      return;
    }
    if (lastRollDice !== prevDice.current) {
      setRollPending(false);
      prevDice.current = lastRollDice;
    }
  }, [lastRollDice, rollPending]);

  const isRolling = rollPending || (!isHumanTurn && thinking.phase !== 'idle' && hasRoll);



  if (!gameState) return null;

  const allBuildActions = [
    { key: 'settlement', label: 'Settlement',   iconName: 'settlement' as const, cost: BUILD_COSTS.settlement, modeKey: 'BUILD_SETTLEMENT' as const, available: hasBuildSettlement },
    { key: 'city',       label: 'City',         iconName: 'city'       as const, cost: BUILD_COSTS.city,       modeKey: 'BUILD_CITY'       as const, available: hasBuildCity       },
    { key: 'road',       label: 'Road',         iconName: 'road'       as const, cost: BUILD_COSTS.road,       modeKey: 'BUILD_ROAD'       as const, available: hasBuildRoad       },
    { key: 'devcard',    label: 'Buy Dev Card', iconName: 'devcard'    as const, cost: BUILD_COSTS.devcard,    modeKey: null               as null,  available: hasBuyDev           },
  ];


  // ---- persistent status card content ----
  const statusContent = (() => {
    if (!humanIndices.length) return null;
    if (!isHumanTurn) return {
      eyebrow: 'Waiting',
      text: `${currentPlayer?.name ?? 'Opponent'} is playing…`, textColor: 'var(--text-faint)' as string,
      progress: null,
    };
    if (hasDiscard) return { eyebrow: 'Action Required', text: 'Choose cards to discard', textColor: 'var(--p-red)' as string, progress: null };
    if (hasMoveRobber) return { eyebrow: 'Place Robber', text: 'Click a tile to move the robber', textColor: 'var(--amber-soft)' as string, progress: null };
    if (isDecideAcceptees) return { eyebrow: 'Trade', text: 'Pick who to trade with', textColor: 'var(--amber-soft)' as string, progress: null };
    if (hasTradeResponse) return { eyebrow: 'Trade Offer', text: 'Respond to the trade offer', textColor: 'var(--amber-soft)' as string, progress: null };
    if (phase === 'INITIAL_BUILD' && hasBuildSettlement) return { eyebrow: 'Setup Phase', text: 'Place your settlement on a corner', textColor: '#6ee7b7' as string, progress: null };
    if (phase === 'INITIAL_BUILD' && hasBuildRoad) return { eyebrow: 'Setup Phase', text: 'Place a road next to your settlement', textColor: '#6ee7b7' as string, progress: null };
    if (hasRoll) return { eyebrow: 'Your Turn', text: 'Roll the dice to start', textColor: 'var(--amber-soft)' as string, progress: null };
    if (mode === 'BUILD_ROAD' || roadIsForced) return { eyebrow: 'Build Mode', text: 'Click a glowing edge to place road', textColor: 'var(--sapphire-bright)' as string, progress: null };
    if (mode === 'BUILD_SETTLEMENT') return { eyebrow: 'Build Mode', text: 'Click a glowing corner to place settlement', textColor: '#6ee7b7' as string, progress: null };
    if (mode === 'BUILD_CITY') return { eyebrow: 'Build Mode', text: 'Click a settlement to upgrade to city', textColor: 'var(--amber-soft)' as string, progress: null };
    if (hasEndTurn) return { eyebrow: 'Your Turn', text: 'Build, trade, or end your turn', textColor: 'var(--text-dim)' as string, progress: null };
    return { eyebrow: 'Your Turn', text: 'Awaiting action…', textColor: 'var(--text-faint)' as string, progress: null };
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width, pointerEvents: 'auto' }}>

      {statusContent && (
        <div className="panel" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div
            className="eyebrow"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>{statusContent.eyebrow}</span>
            {statusContent.progress !== null && (
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--ff-mono, monospace)' }}>
                {Math.round(statusContent.progress)}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: statusContent.textColor, lineHeight: 1.4 }}>
            {statusContent.text}
          </div>
          {statusContent.progress !== null && (
            <div style={{ height: 3, background: 'var(--glass-hi)', borderRadius: 4, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'var(--sapphire-bright)', borderRadius: 4 }}
                animate={{ width: `${statusContent.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>
      )}

      {/* Special phase panels — only shown during human's turn */}
      {isHumanTurn && hasDiscard && <DiscardPanel onAction={onAction} disabled={disabled} />}
      {!floatTrade && isHumanTurn && isDecideAcceptees && (
        <DecideAccepteesPanel
          onAction={onAction} disabled={disabled} actions={playableActions}
          trade={currentTrade} players={playersList}
        />
      )}
      {!floatTrade && isHumanTurn && hasTradeResponse && (
        <TradeResponse
          onAction={onAction} disabled={disabled} actions={playableActions}
          trade={currentTrade} players={playersList} offererIdx={offererIdx}
        />
      )}

      {/* Floating centred modal for trade phases (desktop) */}
      <AnimatePresence>
        {floatTrade && isHumanTurn && (hasTradeResponse || isDecideAcceptees) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(4,8,16,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: 400, maxWidth: '94vw' }}
            >
              {isDecideAcceptees && (
                <DecideAccepteesPanel
                  onAction={onAction} disabled={disabled} actions={playableActions}
                  trade={currentTrade} players={playersList}
                />
              )}
              {hasTradeResponse && (
                <TradeResponse
                  onAction={onAction} disabled={disabled} actions={playableActions}
                  trade={currentTrade} players={playersList} offererIdx={offererIdx}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dice tray + action buttons */}
      <div className="panel" style={{
        padding: '12px 14px 14px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div className="eyebrow">Dice</div>
        <DiceTray dice={lastRollDice} rolling={isRolling} rollKey={rollKey} />

        {isHumanTurn && hasRoll && (
          <button
            onClick={handleRoll}
            disabled={disabled || isRolling}
            className="btn btn-amber"
            style={{
              width: '100%', padding: '12px 0', fontSize: 14,
              fontFamily: 'var(--ff-display)', fontWeight: 700, letterSpacing: '0.03em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="dice" size={17} color="#2a1a05" />
            {isRolling ? 'Rolling…' : 'Roll Dice'}
          </button>
        )}

        {isHumanTurn && hasEndTurn && !hasRoll && (
          <button
            onClick={() => onAction({ action_type: 'END_TURN', value: null })}
            disabled={disabled}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '12px 0', fontSize: 14,
              fontFamily: 'var(--ff-display)', fontWeight: 700, letterSpacing: '0.03em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <Icon name="arrow-right" size={17} color="#fff" />
            End Turn
          </button>
        )}

      </div>

      {isHumanTurn && !hasDiscard && !hasMoveRobber && !isDecideAcceptees && !hasTradeResponse && (
        <div className="panel" style={{ padding: '10px 12px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Player Trade</div>
          <button
            onClick={() => onAction({ action_type: 'OFFER_TRADE', value: '__open_modal__' })}
            disabled={!isOfferTradeAllowed}
            className="btn"
            style={{
              width: '100%', padding: '9px 0', fontSize: 12.5,
              fontFamily: 'var(--ff-display)', fontWeight: 700, letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              borderColor: isOfferTradeAllowed ? 'rgba(63,135,242,0.45)' : 'var(--hairline)',
              color: isOfferTradeAllowed ? 'var(--sapphire-bright)' : 'var(--text-ghost)',
              opacity: isOfferTradeAllowed ? 1 : 0.5,
            }}
          >
            <Icon name="swap" size={14} color={isOfferTradeAllowed ? 'var(--sapphire-bright)' : 'var(--text-ghost)'} />
            {isOfferTradeAllowed ? 'Offer Trade' : 'Roll first'}
          </button>
        </div>
      )}

      <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="eyebrow" style={{ padding: '0 1px 1px' }}>Build</div>
        {allBuildActions.map(b => (
          <BuildButton
            key={b.key}
            label={b.label}
            iconName={b.iconName}
            cost={b.cost}
            resources={resources}
            rolled={rolled}
            isMyTurn={isHumanTurn}
            available={b.available}
            active={b.modeKey ? mode === b.modeKey : false}
            disabled={disabled}
            onClick={() => {
              if (!isHumanTurn) return;
              if (b.modeKey) {
                setMode(mode === b.modeKey ? 'IDLE' : b.modeKey);
              } else {
                onAction({ action_type: 'BUY_DEVELOPMENT_CARD', value: null });
              }
            }}
          />
        ))}

      </div>

    </div>
  );
}
