import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { ActionRecord } from '@/shared/types/game';
import type { PlayerColor } from '@/shared/types/game';

// ---- helpers ----------------------------------------------------------------

function pwinPct(action: ActionRecord | null | undefined, color: string | null | undefined): number | null {
  if (!action?.pwin_by_color || !color) return null;
  const v = action.pwin_by_color[color];
  return typeof v === 'number' ? Math.round(v * 100) : null;
}

// ---- PwinBar ----------------------------------------------------------------

function PwinBar({ pct, color }: { pct: number | null; color: string }) {
  if (pct === null) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{
        flex: 1, height: 5, borderRadius: 3,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 3, background: color }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 36, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

// ---- ActionCard -------------------------------------------------------------

function ActionCard({
  action, label, accent, playerColor,
}: {
  action: ActionRecord | null | undefined;
  label: string;
  accent: string;
  playerColor: string | null | undefined;
}) {
  const pct = pwinPct(action, playerColor);

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${accent}30`,
      background: `color-mix(in srgb, ${accent} 8%, rgba(255,255,255,0.02))`,
    }}>
      {/* card header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px 6px',
        borderBottom: `1px solid ${accent}20`,
        background: `${accent}12`,
      }}>
        <span style={{
          fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: accent,
        }}>
          {label}
        </span>
        {pct !== null && (
          <span style={{
            fontSize: 11, fontWeight: 800,
            padding: '2px 7px', borderRadius: 6,
            background: `${accent}20`, color: accent,
            border: `1px solid ${accent}35`,
          }}>
            {pct}% win
          </span>
        )}
      </div>

      {/* card body */}
      <div style={{ padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {action ? (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>
              {action.description || action.action_type}
            </div>
            {pct !== null && <PwinBar pct={pct} color={accent} />}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-ghost)', fontStyle: 'italic' }}>—</div>
        )}
      </div>
    </div>
  );
}

// ---- Skeleton ---------------------------------------------------------------

function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--hairline)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: 32, background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid var(--hairline)',
      }} />
      <div style={{ padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 13, borderRadius: 5, background: 'rgba(255,255,255,0.05)', width: '70%' }} />
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  );
}

// ---- DeltaChip --------------------------------------------------------------

function DeltaChip({ raw }: { raw: string }) {
  const num = parseFloat(raw);
  const isGood = !isNaN(num) && num >= 0;
  const accent = isGood ? '#4ade80' : '#f87171';
  const sign   = isGood ? '▲' : '▼';
  const display = isNaN(num) ? raw : `${sign} ${Math.abs(num * 100).toFixed(1)}% win`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 8,
      background: `color-mix(in srgb, ${accent} 10%, rgba(255,255,255,0.02))`,
      border: `1px solid ${accent}30`,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Delta
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: accent }}>
        {display}
      </span>
    </div>
  );
}

// ---- Main -------------------------------------------------------------------

export default function AnalysisPanel({ mobile = false }: { mobile?: boolean }) {
  const analysis = useGameStore(s => s.replayAnalysis);
  const loading  = useGameStore(s => s.replayAnalysisLoading);
  const isReplay = useGameStore(s => s.replayMode);

  if (!isReplay) return null;

  // ── Compact 2-column mobile layout ─────────────────────────────────────────
  if (mobile) {
    if (loading) {
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, height: 70, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)', animation: 'thinking-pulse 1.2s ease-in-out infinite' }} />
          <div style={{ flex: 1, height: 70, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)', animation: 'thinking-pulse 1.2s ease-in-out infinite' }} />
        </div>
      );
    }
    if (!analysis) {
      return (
        <div style={{ fontSize: 11, color: 'var(--text-ghost)', textAlign: 'center', padding: '10px 0' }}>
          Scrub to a human move to see analysis
        </div>
      );
    }
    const cols: { label: string; accent: string; action: ActionRecord | null | undefined }[] = [
      { label: 'Move Taken', accent: 'var(--amber)',        action: analysis.action_taken },
      { label: 'Best Move',  accent: 'var(--sapphire-bright)', action: analysis.best_action },
    ];
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {cols.map(col => (
          <div key={col.label} style={{
            flex: 1, borderRadius: 10, overflow: 'hidden',
            border: `1px solid color-mix(in srgb, ${col.accent} 30%, transparent)`,
            background: `color-mix(in srgb, ${col.accent} 7%, rgba(255,255,255,0.02))`,
          }}>
            <div style={{
              padding: '5px 9px', borderBottom: `1px solid color-mix(in srgb, ${col.accent} 20%, transparent)`,
              background: `color-mix(in srgb, ${col.accent} 12%, transparent)`,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: col.accent }}>
                {col.label}
              </span>
            </div>
            <div style={{ padding: '8px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>
              {col.action
                ? (col.action.description || col.action.action_type)
                : <span style={{ color: 'var(--text-ghost)', fontStyle: 'italic' }}>—</span>
              }
            </div>
          </div>
        ))}
      </div>
    );
  }

  const playerColor = analysis?.acting_player ?? null;
  const hex = playerColor ? (PLAYER_COLORS[playerColor as PlayerColor] ?? '#ccc') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2px',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'var(--text-faint)',
        }}>
          Move Analysis
        </span>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="thinking-pulse"
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-ghost)' }}
            >
              Analyzing…
            </motion.span>
          ) : hex && playerColor ? (
            <motion.span
              key={playerColor}
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                padding: '3px 8px', borderRadius: 6,
                color: hex,
                background: `${hex}18`,
                border: `1px solid ${hex}35`,
              }}
            >
              {playerColor}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
          >
            <SkeletonCard />
            <SkeletonCard />
          </motion.div>
        ) : analysis ? (
          <motion.div
            key={analysis.step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
          >
            <ActionCard
              action={analysis.action_taken}
              label="Move Taken"
              accent="var(--amber)"
              playerColor={playerColor}
            />
            <ActionCard
              action={analysis.best_action}
              label="Best Move"
              accent="#4ade80"
              playerColor={playerColor}
            />

            {analysis.win_probability_delta && (
              <DeltaChip raw={analysis.win_probability_delta} />
            )}

            {(analysis.explanation || analysis.explanation_error) && (
              <div style={{
                padding: '9px 10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--hairline)',
                fontSize: 11.5, lineHeight: 1.55,
                color: analysis.explanation_error ? 'var(--text-ghost)' : 'var(--text-dim)',
                fontStyle: analysis.explanation_error ? 'italic' : 'normal',
              }}>
                {analysis.explanation ?? analysis.explanation_error}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              padding: '14px 12px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hairline)',
              fontSize: 12, color: 'var(--text-ghost)',
            }}
          >
            Analysis only available for human moves
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
