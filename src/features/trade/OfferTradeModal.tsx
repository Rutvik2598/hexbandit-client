// Submits OFFER_TRADE with a 10-element value array [give×5, want×5] in RESOURCE_ORDER.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ResourceIcon } from '@/shared/components/ResourceIcon';
import { Icon } from '@/shared/components/Icon';
import { RESOURCE_ORDER, RESOURCE_LABELS, PLAYER_COLORS } from '@/shared/constants';
import type { ResourceType, ResourceCounts, PlayableAction, PlayerColor } from '@/shared/types/game';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

interface Props {
  hand: ResourceCounts;
  players: Array<{ name: string; color: string; index: number }>;
  onConfirm: (action: PlayableAction) => void;
  onClose: () => void;
}

// ---- resource stepper row ---------------------------------------------------

interface StepperProps {
  type: ResourceType;
  count: number;
  max: number;
  onChange: (v: number) => void;
  accent: string;
}

function ResourceStepper({ type, count, max, onChange, accent }: StepperProps) {
  const canInc = count < max;
  const canDec = count > 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 12,
      background: count > 0 ? `color-mix(in srgb, ${accent} 10%, rgba(255,255,255,0.03))` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${count > 0 ? accent : 'var(--hairline)'}`,
      transition: 'all 0.15s',
    }}>
      <ResourceIcon type={type} size={22} shadow={false} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: count > 0 ? 'var(--text)' : 'var(--text-dim)' }}>
        {RESOURCE_LABELS[type]}
      </span>
      {max < Infinity && (
        <span style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 600 }}>
          have {max}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => canDec && onChange(count - 1)}
          disabled={!canDec}
          style={{
            width: 28, height: 28, borderRadius: 8, border: '1px solid var(--glass-brd)',
            background: canDec ? 'var(--glass-hi)' : 'rgba(255,255,255,0.03)',
            color: canDec ? 'var(--text)' : 'var(--text-ghost)',
            fontSize: 16, cursor: canDec ? 'pointer' : 'not-allowed',
            display: 'grid', placeItems: 'center', lineHeight: 1,
            transition: 'background 0.12s',
          }}
        >−</button>

        <span style={{
          width: 28, textAlign: 'center',
          fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 16,
          color: count > 0 ? accent : 'var(--text-faint)',
        }}>
          {count}
        </span>

        <button
          onClick={() => canInc && onChange(count + 1)}
          disabled={!canInc}
          style={{
            width: 28, height: 28, borderRadius: 8, border: '1px solid var(--glass-brd)',
            background: canInc ? 'var(--glass-hi)' : 'rgba(255,255,255,0.03)',
            color: canInc ? 'var(--text)' : 'var(--text-ghost)',
            fontSize: 16, cursor: canInc ? 'pointer' : 'not-allowed',
            display: 'grid', placeItems: 'center', lineHeight: 1,
            transition: 'background 0.12s',
          }}
        >+</button>
      </div>
    </div>
  );
}

// ---- summary line -----------------------------------------------------------

function TradeLineSummary({ give, want }: {
  give: Partial<Record<ResourceType, number>>;
  want: Partial<Record<ResourceType, number>>;
}) {
  const giveList = RESOURCE_ORDER.filter(r => (give[r] ?? 0) > 0);
  const wantList = RESOURCE_ORDER.filter(r => (want[r] ?? 0) > 0);

  const renderRes = (r: ResourceType, n: number, color: string) => (
    <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <ResourceIcon type={r} size={14} shadow={false} />
      <span style={{ fontWeight: 800, color }}>{n} {RESOURCE_LABELS[r]}</span>
    </span>
  );

  if (giveList.length === 0 && wantList.length === 0) {
    return <span style={{ color: 'var(--text-faint)' }}>Set what you'll give and what you want</span>;
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {giveList.length > 0 ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Give {giveList.map(r => renderRes(r, give[r]!, 'var(--sapphire-bright)'))}
        </span>
      ) : <span style={{ color: 'var(--text-faint)' }}>Give ?</span>}
      <Icon name="arrow-right" size={14} color="var(--text-ghost)" />
      {wantList.length > 0 ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Want {wantList.map(r => renderRes(r, want[r]!, 'var(--amber-soft)'))}
        </span>
      ) : <span style={{ color: 'var(--text-faint)' }}>Want ?</span>}
    </span>
  );
}

// ---- main component ---------------------------------------------------------

export function OfferTradeModal({ hand, players, onConfirm, onClose }: Props) {
  const [give, setGive] = useState<Partial<Record<ResourceType, number>>>({});
  const [want, setWant] = useState<Partial<Record<ResourceType, number>>>({});
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const totalGive = RESOURCE_ORDER.reduce((s, r) => s + (give[r] ?? 0), 0);
  const totalWant = RESOURCE_ORDER.reduce((s, r) => s + (want[r] ?? 0), 0);
  const canSubmit = totalGive > 0 && totalWant > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const value = [
      ...RESOURCE_ORDER.map(r => give[r] ?? 0),
      ...RESOURCE_ORDER.map(r => want[r] ?? 0),
    ];
    onConfirm({ action_type: 'OFFER_TRADE', value });
    onClose();
  };

  const otherPlayers = players.filter(p => p.index !== 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? '12px' : 0,
          background: 'rgba(4,8,16,0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          className="panel"
          style={{
            width: 540, maxWidth: '100%', padding: 0,
            maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
            background: 'var(--glass-2)', boxShadow: 'var(--sh-pop)',
            borderRadius: 'var(--r-xl)',
          }}
        >
          {/* header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '12px 16px 10px' : '15px 22px 13px',
            borderBottom: '1px solid var(--hairline)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
                background: 'linear-gradient(180deg, color-mix(in srgb,var(--sapphire-bright) 26%,transparent), transparent)',
                border: '1px solid var(--sapphire-deep)',
                flexShrink: 0,
              }}>
                <Icon name="swap" size={18} color="var(--sapphire-bright)" />
              </span>
              <div>
                <h2 style={{
                  fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isMobile ? 17 : 19, margin: 0,
                  letterSpacing: '0.03em', color: 'var(--text)',
                }}>Offer Trade</h2>
                {!isMobile && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, marginTop: 2 }}>
                    Propose a deal to other players
                    {otherPlayers.length > 0 && (
                      <span style={{ marginLeft: 6 }}>
                        — {otherPlayers.map((p, i) => (
                          <span key={p.index}>
                            <span style={{ color: PLAYER_COLORS[p.color as PlayerColor] || '#ccc', fontWeight: 800 }}>
                              {p.name}
                            </span>
                            {i < otherPlayers.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="btn" style={{
              width: 34, height: 34, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 9, flexShrink: 0,
            }}>
              <Icon name="close" size={17} color="var(--text-dim)" />
            </button>
          </div>

          {/* body — two columns on tablet+, stacked on mobile */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 0,
            overflowY: 'auto',
            flex: 1,
          }}>
            {/* You Give */}
            <div style={{
              padding: isMobile ? '14px 16px' : '16px 18px 16px 22px',
              borderRight: isMobile ? 'none' : '1px solid var(--hairline)',
              borderBottom: isMobile ? '1px solid var(--hairline)' : 'none',
            }}>
              <div className="eyebrow" style={{ color: 'var(--sapphire-bright)', marginBottom: 10 }}>
                You Give
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {RESOURCE_ORDER.map(r => (
                  <ResourceStepper
                    key={r}
                    type={r}
                    count={give[r] ?? 0}
                    max={hand[r] ?? 0}
                    onChange={v => setGive(s => ({ ...s, [r]: v }))}
                    accent="var(--sapphire-bright)"
                  />
                ))}
              </div>
              {totalGive > 0 && (
                <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: 'var(--sapphire-bright)', textAlign: 'right' }}>
                  {totalGive} card{totalGive !== 1 ? 's' : ''} offered
                </div>
              )}
            </div>

            {/* You Want */}
            <div style={{ padding: isMobile ? '14px 16px' : '16px 22px 16px 18px' }}>
              <div className="eyebrow" style={{ color: 'var(--amber-soft)', marginBottom: 10 }}>
                You Want
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {RESOURCE_ORDER.map(r => (
                  <ResourceStepper
                    key={r}
                    type={r}
                    count={want[r] ?? 0}
                    max={Infinity}
                    onChange={v => setWant(s => ({ ...s, [r]: v }))}
                    accent="var(--amber)"
                  />
                ))}
              </div>
              {totalWant > 0 && (
                <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: 'var(--amber-soft)', textAlign: 'right' }}>
                  {totalWant} card{totalWant !== 1 ? 's' : ''} requested
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            flexDirection: isMobile ? 'column' : 'row',
            padding: isMobile ? '10px 16px 14px' : '11px 22px 15px',
            borderTop: '1px solid var(--hairline)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)', flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
              <TradeLineSummary give={give} want={want} />
            </div>
            <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : undefined }}>
              <button onClick={onClose} className="btn" style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 700,
                flex: isMobile ? 1 : undefined,
              }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`btn${canSubmit ? ' btn-primary' : ''}`}
                style={{
                  padding: '10px 20px', fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: canSubmit ? 1 : 0.45,
                  flex: isMobile ? 2 : undefined,
                }}
              >
                <Icon name="swap" size={15} color={canSubmit ? '#fff' : 'var(--text-faint)'} />
                Send Offer
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
