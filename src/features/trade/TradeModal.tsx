/**
 * TradeModal — maritime trade (bank/port trade) modal window.
 * Shows "You Give" and "You Receive" sections; uses port rates from the
 * playable actions to show each resource's effective trading rate.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ResourceIcon } from '@/shared/components/ResourceIcon';
import { Icon } from '@/shared/components/Icon';
import { RESOURCE_CONFIG } from '@/features/resource-hand/ResourceStack';
import type { ResourceType, PlayableAction, ResourceCounts } from '@/shared/types/game';
import { RESOURCE_ORDER } from '@/shared/constants';

interface TradeModalProps {
  hand: ResourceCounts;
  bank: ResourceCounts;
  /** All MARITIME_TRADE playable actions for the current turn. */
  maritimeActions: PlayableAction[];
  onConfirm: (action: PlayableAction) => void;
  onClose: () => void;
}

function rateFor(res: ResourceType, actions: PlayableAction[]): number | null {
  for (const a of actions) {
    if (a.action_type !== 'MARITIME_TRADE' || !Array.isArray(a.value)) continue;
    const val = a.value as (number | null)[];
    const giveIndices = val.slice(0, -1).filter((v): v is number => v !== null);
    if (giveIndices.length > 0 && RESOURCE_ORDER[giveIndices[0]] === res) {
      return giveIndices.length;
    }
  }
  return null;
}

function findAction(
  give: ResourceType,
  recv: ResourceType,
  actions: PlayableAction[],
): PlayableAction | undefined {
  return actions.find(a => {
    if (a.action_type !== 'MARITIME_TRADE' || !Array.isArray(a.value)) return false;
    const val = a.value as (number | null)[];
    const giveIndices = val.slice(0, -1).filter((v): v is number => v !== null);
    const recvIdx = val[val.length - 1];
    return (
      giveIndices.every(v => v === RESOURCE_ORDER.indexOf(give)) &&
      recvIdx === RESOURCE_ORDER.indexOf(recv)
    );
  });
}

interface TradeChipProps {
  resource: typeof RESOURCE_CONFIG[0];
  mode: 'give' | 'receive';
  rate: number | null;
  count: number;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function TradeChip({ resource, mode, rate, count, selected, disabled, onClick }: TradeChipProps) {
  const [hover, setHover] = useState(false);
  const selColor = mode === 'give' ? 'var(--sapphire-bright)' : 'var(--amber)';
  const selGlow  = mode === 'give' ? 'var(--sapphire-glow)'   : 'var(--amber-glow)';

  return (
    <button
      onClick={() => !disabled && onClick()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 90,
        padding: '10px 7px 8px',
        borderRadius: 13,
        background: selected
          ? `linear-gradient(165deg, color-mix(in srgb, ${resource.color} 40%, #0e1a2e), #0c1626)`
          : `linear-gradient(165deg, color-mix(in srgb, ${resource.color} 18%, #0e1a2e), #0c1626)`,
        border: `1px solid ${selected ? selColor : 'var(--glass-brd)'}`,
        boxShadow: selected
          ? `0 0 0 1px ${selColor}, 0 0 22px -3px ${selGlow}`
          : 'var(--sh-card)',
        opacity: disabled ? 0.32 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        transition: 'all 0.15s ease',
        transform: hover && !disabled && !selected ? 'translateY(-4px)' : 'none',
        filter: disabled ? 'grayscale(0.6)' : 'none',
      }}
    >
      {/* top colour stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        borderRadius: '13px 13px 0 0', background: resource.color, opacity: 0.9,
      }} />

      {/* icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
        marginTop: 2,
      }}>
        <ResourceIcon type={resource.key} size={28} shadow={false} />
      </div>

      {/* name */}
      <span style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-dim)',
      }}>{resource.name}</span>

      {/* rate / count line */}
      {mode === 'give'
        ? <span style={{
            fontSize: 10, fontWeight: 800,
            color: rate !== null && rate <= 3 ? 'var(--amber-soft)' : 'var(--text-faint)',
          }}>
            {count} cards · {rate !== null ? `${rate}:1` : '—'}
            {rate !== null && rate <= 3 ? ' ⚓' : ''}
          </span>
        : <span style={{ fontSize: 10, fontWeight: 800, color: count === 0 ? 'var(--text-ghost)' : 'var(--text-dim)' }}>
            bank: {count}
          </span>
      }

      {/* selected check */}
      {selected && (
        <span style={{
          position: 'absolute', top: 7, right: 7,
          width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: selColor,
        }}>
          <Icon name="check" size={12} color={mode === 'give' ? '#fff' : '#2a1a05'} />
        </span>
      )}
    </button>
  );
}

export function TradeModal({ hand, bank, maritimeActions, onConfirm, onClose }: TradeModalProps) {
  const [give, setGive] = useState<ResourceType | null>(null);
  const [recv, setRecv] = useState<ResourceType | null>(null);

  const ratio  = give ? (rateFor(give, maritimeActions) ?? 4) : 4;
  const action = give && recv ? findAction(give, recv, maritimeActions) : undefined;
  const ok     = !!action;

  const handleConfirm = () => {
    if (ok && action) {
      onConfirm(action);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'grid', placeItems: 'center',
          background: 'rgba(4,8,16,0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
          onClick={e => e.stopPropagation()}
          className="panel"
          style={{
            width: 580, maxWidth: '94vw', padding: 0, overflow: 'hidden',
            background: 'var(--glass-2)', boxShadow: 'var(--sh-pop)',
            borderRadius: 'var(--r-xl)',
          }}
        >
          {/* header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '15px 22px 12px',
            borderBottom: '1px solid var(--hairline)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
                background: 'linear-gradient(180deg, color-mix(in srgb,var(--amber) 26%,transparent), transparent)',
                border: '1px solid var(--amber-deep)',
              }}>
                <Icon name="bank" size={19} color="var(--amber)" />
              </span>
              <div>
                <h2 style={{
                  fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 20, margin: 0,
                  letterSpacing: '0.03em', color: 'var(--text)',
                }}>Trade with Bank</h2>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, marginTop: 2 }}>
                  Standard rate 4:1 · ports improve your rate
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn" style={{
              width: 34, height: 34, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 9,
            }}>
              <Icon name="close" size={17} color="var(--text-dim)" />
            </button>
          </div>

          {/* body */}
          <div style={{ padding: '18px 22px 4px' }}>
            {/* You Give */}
            <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--sapphire-bright)' }}>You Give</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {RESOURCE_CONFIG.map(r => {
                const rate = rateFor(r.key, maritimeActions);
                const disabled = rate === null || hand[r.key] < rate;
                return (
                  <TradeChip
                    key={r.key}
                    resource={r}
                    mode="give"
                    rate={rate}
                    count={hand[r.key] ?? 0}
                    selected={give === r.key}
                    disabled={disabled}
                    onClick={() => { setGive(r.key); if (recv === r.key) setRecv(null); }}
                  />
                );
              })}
            </div>

            {/* exchange arrow */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '12px 0',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
              <div style={{
                fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14,
                color: ok ? 'var(--amber-soft)' : 'var(--text-ghost)',
                minWidth: 50, textAlign: 'right',
              }}>
                {give ? `${ratio} : 1` : '— : 1'}
              </div>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
                background: ok
                  ? 'linear-gradient(180deg,var(--amber-soft),var(--amber))'
                  : 'var(--glass-hi)',
                border: `1px solid ${ok ? 'var(--amber)' : 'var(--glass-brd)'}`,
                boxShadow: ok ? '0 0 22px -4px var(--amber-glow)' : 'none',
                transition: 'all 0.2s',
                transform: 'rotate(90deg)',
              }}>
                <Icon name="arrow-right" size={20} color={ok ? '#2a1a05' : 'var(--text-faint)'} />
              </div>
              <div style={{ minWidth: 50 }} />
              <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            </div>

            {/* You Receive */}
            <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--amber-soft)' }}>You Receive</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {RESOURCE_CONFIG.map(r => {
                const disabled = !give || (bank[r.key] ?? 0) === 0 || r.key === give;
                return (
                  <TradeChip
                    key={r.key}
                    resource={r}
                    mode="receive"
                    rate={null}
                    count={bank[r.key] ?? 0}
                    selected={recv === r.key}
                    disabled={disabled}
                    onClick={() => setRecv(r.key)}
                  />
                );
              })}
            </div>
          </div>

          {/* footer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 22px 16px',
            borderTop: '1px solid var(--hairline)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', minHeight: 20, flex: 1 }}>
              {ok
                ? <span>Trade <span style={{ color: 'var(--sapphire-bright)' }}>{ratio} {give}</span> for <span style={{ color: 'var(--amber-soft)' }}>1 {recv}</span></span>
                : <span style={{ color: 'var(--text-faint)' }}>Select a resource to give and one to receive</span>
              }
            </div>
            <button onClick={onClose} className="btn" style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700 }}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!ok}
              className={`btn${ok ? ' btn-amber' : ''}`}
              style={{ padding: '10px 22px', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <Icon name="check" size={15} color={ok ? '#2a1a05' : 'var(--text-faint)'} />
              Confirm Trade
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
