/**
 * ActionPanel — the bottom-left command zone that floats over the board.
 *
 * Layout:
 *   Left column (fixed 190px): DiceTray + Roll/EndTurn button + Build buttons
 *   (Resource hand is rendered separately in the centre by GamePage)
 *
 * Special phases (discard, move robber, trade response) render an overlay
 * panel instead of the normal build column.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
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
  const afford = canAfford(resources, cost);
  // Clickable only when it's your turn, rolled, server allows it, and you can afford it
  const ready  = afford && rolled && isMyTurn && available && !disabled;

  const bg = hover && ready
    ? 'var(--bg-3)'
    : afford && isMyTurn
    ? 'var(--glass-2)'
    : 'rgba(255,255,255,0.025)';

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
        border: `1px solid ${active ? 'var(--sapphire-bright)' : afford && isMyTurn ? 'var(--glass-brd2)' : 'var(--hairline)'}`,
        color: afford ? 'var(--text)' : 'var(--text-faint)',
        textAlign: 'left', cursor: ready ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s, transform 0.12s',
        transform: hover && ready ? 'translateY(-1px)' : 'none',
        opacity: isMyTurn ? (afford ? 1 : 0.55) : 0.4,
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

      {/* amber dot — shows whenever you can afford it (your turn or not) */}
      {afford && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: 'var(--amber)',
          boxShadow: isMyTurn ? '0 0 8px var(--amber-glow)' : 'none',
          opacity: isMyTurn ? 1 : 0.4,
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

// ---- ResourcePicker (YoP / Monopoly) ------------------------------------

function ResourcePicker({
  title, onPick, onCancel, disabled,
}: { title: string; onPick: (_: ResourceType) => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RESOURCE_ORDER.map(res => (
          <button key={res} onClick={() => !disabled && onPick(res)} disabled={disabled}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-brd)', cursor: 'pointer', minWidth: 44,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--glass-hi)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <ResourceIcon type={res} size={22} shadow={false} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              {RESOURCE_LABELS[res]}
            </span>
          </button>
        ))}
      </div>
      <button onClick={onCancel} style={{ fontSize: 11, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  );
}

// ---- TradeTerms — parse and display current_trade from game state ----------

function TradeTerms({ trade, offererName, offererColor }: {
  trade: number[];
  offererName: string;
  offererColor: string;
}) {
  const offered = RESOURCE_ORDER.map((r, i) => ({ r, n: trade[i] ?? 0 })).filter(x => x.n > 0);
  const wanted  = RESOURCE_ORDER.map((r, i) => ({ r, n: trade[i + 5] ?? 0 })).filter(x => x.n > 0);
  const color   = PLAYER_COLORS[offererColor as PlayerColor] || '#ccc';

  return (
    <div style={{
      padding: '8px 10px', borderRadius: 9,
      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
        <span style={{ color, fontWeight: 800 }}>{offererName}</span> offers
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* gives */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {offered.length > 0
            ? offered.map(({ r, n }) => (
                <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ResourceIcon type={r} size={14} shadow={false} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--sapphire-bright)' }}>{n}</span>
                </span>
              ))
            : <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>nothing</span>
          }
        </div>
        <Icon name="swap" size={13} color="var(--text-ghost)" />
        {/* wants */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {wanted.length > 0
            ? wanted.map(({ r, n }) => (
                <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ResourceIcon type={r} size={14} shadow={false} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--amber-soft)' }}>{n}</span>
                </span>
              ))
            : <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>nothing</span>
          }
        </div>
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

  return (
    <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="eyebrow">Trade Offer</div>
      {offerer && trade.length >= 10 && (
        <TradeTerms trade={trade} offererName={offerer.name} offererColor={offerer.color} />
      )}
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

  return (
    <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="eyebrow">Choose Trade Partner</div>
      {trade.length >= 10 && players[trade[10]] && (
        <TradeTerms trade={trade} offererName="You" offererColor={players[trade[10]]?.color ?? ''} />
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
}

export default function ActionPanel({ onAction, disabled }: ActionPanelProps) {
  const gameState     = useGameStore(s => s.gameState);
  const thinking      = useGameStore(s => s.thinking);
  const lastRollDice  = useGameStore(s => s.lastRollDice);
  const humanIndices  = useGameStore(s => s.humanPlayerIndices);
  const mode          = useInteractionStore(s => s.mode);
  const setMode       = useInteractionStore(s => s.setMode);

  const [yopPick, setYopPick]     = useState<ResourceType | null>(null);
  const [rollPending, setRollPending] = useState(false);
  const [rollKey, setRollKey]     = useState(0);
  const prevDice = useRef<typeof lastRollDice>(lastRollDice);

  const playableActions = gameState?.playable_actions ?? [];
  const phase = gameState?.game_phase;
  const isHumanTurn    = humanIndices.includes(gameState?.current_player_index ?? -1);
  const currentPlayer  = gameState?.players[gameState.current_player_index];
  // Always use the human player's resources for affordability display
  const humanPlayer    = gameState?.players[humanIndices[0] ?? -1];
  const resources      = humanPlayer?.resources ?? {};

  const hasRoll       = playableActions.some(a => a.action_type === 'ROLL');
  const hasEndTurn    = playableActions.some(a => a.action_type === 'END_TURN');
  const hasBuildRoad  = playableActions.some(a => a.action_type === 'BUILD_ROAD');
  const hasBuildSettlement = playableActions.some(a => a.action_type === 'BUILD_SETTLEMENT');
  const hasBuildCity  = playableActions.some(a => a.action_type === 'BUILD_CITY');
  const hasBuyDev     = playableActions.some(a => a.action_type === 'BUY_DEVELOPMENT_CARD');
  const hasPlayKnight = playableActions.some(a => a.action_type === 'PLAY_KNIGHT_CARD');
  const hasPlayYop    = playableActions.some(a => a.action_type === 'PLAY_YEAR_OF_PLENTY');
  const hasPlayMono   = playableActions.some(a => a.action_type === 'PLAY_MONOPOLY');
  const hasPlayRoadBuilding = playableActions.some(a => a.action_type === 'PLAY_ROAD_BUILDING');
  const hasDiscard    = phase === 'DISCARDING';
  const hasMoveRobber = phase === 'MOVING_ROBBER';
  const isDecideAcceptees = phase === 'DECIDE_ACCEPTEES';
  const hasTradeResponse = !isDecideAcceptees && playableActions.some(a =>
    a.action_type === 'ACCEPT_TRADE' || a.action_type === 'REJECT_TRADE' ||
    a.action_type === 'CANCEL_TRADE');
  const isOfferTradeAllowed = !!(gameState?.is_trade_allowed) && isHumanTurn && !disabled;

  // current_trade: [give×5, want×5, offererIdx]
  const currentTrade = gameState?.current_trade ?? [];
  const offererIdx   = currentTrade[10] ?? 0;
  const playersList  = (gameState?.players ?? []).map(p => ({ name: p.name, color: p.color }));

  const rolled = !hasRoll && !!lastRollDice;

  // Auto-activate road mode when it's the only action
  const roadIsForced = hasBuildRoad && !hasRoll && !hasBuildSettlement && !hasBuildCity && !hasEndTurn && !hasDiscard && !hasMoveRobber;
  useEffect(() => {
    if (roadIsForced && !disabled) setMode('BUILD_ROAD');
  }, [roadIsForced, disabled, setMode]);

  // Track roll animation: start when ROLL is submitted, stop when dice arrive
  const handleRoll = () => {
    setRollPending(true);
    setRollKey(k => k + 1);
    onAction({ action_type: 'ROLL', value: null });
  };
  useEffect(() => {
    if (!rollPending) {
      // Keep prevDice in sync so we always know what value was current when the
      // human clicked Roll — bot rolls update lastRollDice without setting rollPending.
      prevDice.current = lastRollDice;
      return;
    }
    if (lastRollDice !== prevDice.current) {
      setRollPending(false);
      prevDice.current = lastRollDice;
    }
  }, [lastRollDice, rollPending]);

  const isRolling = rollPending || (!isHumanTurn && thinking.phase !== 'idle' && hasRoll);

  // Maritime give rates
  const maritimeGiveRates = useMemo(() => {
    const rates = new Map<ResourceType, number>();
    for (const a of playableActions) {
      if (a.action_type !== 'MARITIME_TRADE' || !Array.isArray(a.value)) continue;
      const val = a.value as (number | null)[];
      const giveIndices = val.slice(0, -1).filter((v): v is number => v !== null);
      if (giveIndices.length === 0) continue;
      const res = RESOURCE_ORDER[giveIndices[0]] as ResourceType;
      if (res && !rates.has(res)) rates.set(res, giveIndices.length);
    }
    return rates;
  }, [playableActions]);

  const isThinking = thinking.phase === 'thinking' || thinking.phase === 'submitting';

  if (!gameState) return null;

  // Always show all 4 build types; `available` gates clickability (server must allow it)
  const allBuildActions = [
    { key: 'settlement', label: 'Settlement',   iconName: 'settlement' as const, cost: BUILD_COSTS.settlement, modeKey: 'BUILD_SETTLEMENT' as const, available: hasBuildSettlement },
    { key: 'city',       label: 'City',         iconName: 'city'       as const, cost: BUILD_COSTS.city,       modeKey: 'BUILD_CITY'       as const, available: hasBuildCity       },
    { key: 'road',       label: 'Road',         iconName: 'road'       as const, cost: BUILD_COSTS.road,       modeKey: 'BUILD_ROAD'       as const, available: hasBuildRoad       },
    { key: 'devcard',    label: 'Buy Dev Card', iconName: 'devcard'    as const, cost: BUILD_COSTS.devcard,    modeKey: null               as null,  available: hasBuyDev           },
  ];

  const devActions = [
    hasPlayKnight       && { type: 'PLAY_KNIGHT_CARD'    as const, label: 'Knight',        icon: 'army-badge' as const },
    hasPlayRoadBuilding && { type: 'PLAY_ROAD_BUILDING'  as const, label: 'Road Building', icon: 'road'       as const },
  ].filter(Boolean) as Array<{ type: string; label: string; icon: 'army-badge' | 'road' }>;

  // ---- persistent status card content ----
  const statusContent = (() => {
    if (!humanIndices.length) return null;
    if (isThinking) return {
      eyebrow: 'AI Thinking', eyebrowPulse: true,
      text: thinking.message, textColor: 'var(--text-dim)' as string,
      progress: thinking.progress,
    };
    if (!isHumanTurn) return {
      eyebrow: 'Waiting', eyebrowPulse: false,
      text: `${currentPlayer?.name ?? 'Opponent'} is playing…`, textColor: 'var(--text-faint)' as string,
      progress: null,
    };
    if (hasDiscard) return { eyebrow: 'Action Required', eyebrowPulse: false, text: 'Choose cards to discard', textColor: 'var(--p-red)' as string, progress: null };
    if (hasMoveRobber) return { eyebrow: 'Place Robber', eyebrowPulse: false, text: 'Click a tile to move the robber', textColor: 'var(--amber-soft)' as string, progress: null };
    if (isDecideAcceptees) return { eyebrow: 'Trade', eyebrowPulse: false, text: 'Pick who to trade with', textColor: 'var(--amber-soft)' as string, progress: null };
    if (hasTradeResponse) return { eyebrow: 'Trade Offer', eyebrowPulse: false, text: 'Respond to the trade offer', textColor: 'var(--amber-soft)' as string, progress: null };
    if (phase === 'INITIAL_BUILD' && hasBuildSettlement) return { eyebrow: 'Setup Phase', eyebrowPulse: false, text: 'Place your settlement on a corner', textColor: '#6ee7b7' as string, progress: null };
    if (phase === 'INITIAL_BUILD' && hasBuildRoad) return { eyebrow: 'Setup Phase', eyebrowPulse: false, text: 'Place a road next to your settlement', textColor: '#6ee7b7' as string, progress: null };
    if (hasRoll) return { eyebrow: 'Your Turn', eyebrowPulse: false, text: 'Roll the dice to start', textColor: 'var(--amber-soft)' as string, progress: null };
    if (mode === 'BUILD_ROAD' || roadIsForced) return { eyebrow: 'Build Mode', eyebrowPulse: false, text: 'Click a glowing edge to place road', textColor: 'var(--sapphire-bright)' as string, progress: null };
    if (mode === 'BUILD_SETTLEMENT') return { eyebrow: 'Build Mode', eyebrowPulse: false, text: 'Click a glowing corner to place settlement', textColor: '#6ee7b7' as string, progress: null };
    if (mode === 'BUILD_CITY') return { eyebrow: 'Build Mode', eyebrowPulse: false, text: 'Click a settlement to upgrade to city', textColor: 'var(--amber-soft)' as string, progress: null };
    if (hasEndTurn) return { eyebrow: 'Your Turn', eyebrowPulse: false, text: 'Build, trade, or end your turn', textColor: 'var(--text-dim)' as string, progress: null };
    return { eyebrow: 'Your Turn', eyebrowPulse: false, text: 'Awaiting action…', textColor: 'var(--text-faint)' as string, progress: null };
  })();

  // ---- render ----
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 190, pointerEvents: 'auto' }}>

      {/* Status / hint card — always rendered, never pops in/out */}
      {statusContent && (
        <div className="panel" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div
            className={`eyebrow${statusContent.eyebrowPulse ? ' thinking-pulse' : ''}`}
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
      {isHumanTurn && isDecideAcceptees && (
        <DecideAccepteesPanel
          onAction={onAction} disabled={disabled} actions={playableActions}
          trade={currentTrade} players={playersList}
        />
      )}
      {isHumanTurn && hasTradeResponse && (
        <TradeResponse
          onAction={onAction} disabled={disabled} actions={playableActions}
          trade={currentTrade} players={playersList} offererIdx={offererIdx}
        />
      )}

      {/* YoP picker */}
      {isHumanTurn && hasPlayYop && (
        <ResourcePicker
          title={yopPick ? `Year of Plenty — pick 2nd (got ${yopPick})` : 'Year of Plenty — pick 1st resource'}
          onPick={(res) => {
            if (!yopPick) { setYopPick(res); }
            else {
              onAction({ action_type: 'PLAY_YEAR_OF_PLENTY', value: [RESOURCE_ORDER.indexOf(yopPick), RESOURCE_ORDER.indexOf(res)] });
              setYopPick(null);
            }
          }}
          onCancel={() => setYopPick(null)}
          disabled={disabled}
        />
      )}

      {/* Monopoly picker */}
      {isHumanTurn && hasPlayMono && (
        <ResourcePicker
          title="Monopoly — pick a resource to claim"
          onPick={(res) => onAction({ action_type: 'PLAY_MONOPOLY', value: RESOURCE_ORDER.indexOf(res) })}
          onCancel={() => {}}
          disabled={disabled}
        />
      )}

      {/* Dice tray + main action button — always visible */}
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
              opacity: (disabled || isRolling) ? 0.45 : 1,
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

      {/* Offer Trade — standalone button, only when server allows it */}
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

      {/* Build column — always visible so layout stays stable */}
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

        {/* Dev card action buttons — human turn only */}
        {isHumanTurn && devActions.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--hairline)', margin: '2px 0' }} />
            {devActions.map(d => (
              <button
                key={d.type}
                onClick={() => {
                  onAction({ action_type: d.type as PlayableAction['action_type'], value: null });
                  if (d.type === 'PLAY_KNIGHT_CARD') setMode('MOVE_ROBBER');
                }}
                disabled={disabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9,
                  background: 'rgba(150,130,235,0.1)', border: '1px solid rgba(150,130,235,0.3)',
                  color: '#d4c9f5', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(150,130,235,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(150,130,235,0.1)'; }}
              >
                <Icon name={d.icon} size={15} color="#a98bff" />
                {d.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Maritime trade rate summary (human only) */}
      {isHumanTurn && maritimeGiveRates.size > 0 && !hasDiscard && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingLeft: 2 }}>
          {Array.from(maritimeGiveRates.entries()).map(([res, rate]) => (
            <span key={res} style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 10.5, fontWeight: 700, color: rate <= 3 ? 'var(--amber-soft)' : 'var(--text-faint)',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hairline)',
              borderRadius: 6, padding: '3px 7px',
            }}>
              <ResourceIcon type={res} size={12} shadow={false} />
              {rate}:1
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
