import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import { PLAYER_COLORS } from '@/shared/constants';
import { parseSuggestionHighlight } from '@/shared/utils/parseSuggestionHighlight';
import { formatSuggestionLabel } from '@/shared/utils/formatSuggestionLabel';
import type { ActionRecord, PlayerColor, ActionPwin } from '@/shared/types/game';

// ── Shared helpers ────────────────────────────────────────────────────────────

function pwinPct(action: ActionRecord | null | undefined, color: string | null | undefined): number | null {
  if (!action?.pwin_by_color || !color) return null;
  const v = action.pwin_by_color[color];
  return typeof v === 'number' ? Math.round(v * 100) : null;
}

// ── PwinBar ───────────────────────────────────────────────────────────────────

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

// ── ActionCard (replay) ───────────────────────────────────────────────────────

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--hairline)',
      background: 'rgba(255,255,255,0.02)', overflow: 'hidden',
    }}>
      <div style={{ height: 32, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--hairline)' }} />
      <div style={{ padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 13, borderRadius: 5, background: 'rgba(255,255,255,0.05)', width: '70%' }} />
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 11px', borderRadius: 10,
      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hairline)',
      animation: 'thinking-pulse 1.2s ease-in-out infinite',
    }}>
      <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
      <div style={{ flex: 1, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ width: 36, height: 18, borderRadius: 5, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
    </div>
  );
}

// ── DeltaChip (replay) ────────────────────────────────────────────────────────

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
      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: accent }}>{display}</span>
    </div>
  );
}

// ── LiveSuggestions ───────────────────────────────────────────────────────────

function SuggestionRow({
  rank, label, isTop, deltaPositive, deltaTxt, hasLocation, active, compact,
  onActivate, onDeactivate, onTap,
}: {
  rank: number; label: string; isTop: boolean;
  deltaPositive: boolean; deltaTxt: string;
  hasLocation: boolean; active: boolean; compact: boolean;
  onActivate: () => void; onDeactivate: () => void;
  onTap?: () => void;
}) {
  const deltaColor = deltaPositive ? '#4ade80' : '#f87171';

  return (
    <div
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onClick={onTap ?? onActivate}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: compact ? '7px 10px' : '9px 11px',
        borderRadius: 10,
        background: active
          ? 'color-mix(in srgb, var(--sapphire) 22%, rgba(255,255,255,0.04))'
          : isTop
            ? 'color-mix(in srgb, var(--sapphire) 14%, rgba(255,255,255,0.03))'
            : 'rgba(255,255,255,0.025)',
        border: `1px solid ${active ? 'rgba(63,135,242,0.6)' : isTop ? 'rgba(63,135,242,0.35)' : 'var(--hairline)'}`,
        transition: 'background 0.13s, border-color 0.13s',
        cursor: hasLocation ? 'pointer' : 'default',
      }}
    >
      {/* Rank badge */}
      <span style={{
        width: compact ? 18 : 20, height: compact ? 18 : 20,
        borderRadius: 6, flexShrink: 0, display: 'grid', placeItems: 'center',
        fontSize: compact ? 9 : 10, fontWeight: 800,
        background: isTop ? 'var(--sapphire)' : 'rgba(255,255,255,0.06)',
        color: isTop ? '#fff' : 'var(--text-ghost)',
      }}>
        {rank}
      </span>

      {/* Move label */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: compact ? 11.5 : 12.5,
        fontWeight: isTop ? 700 : 600,
        color: active ? 'var(--text)' : isTop ? 'var(--text)' : 'var(--text-dim)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}>
        {label}
      </span>

      {/* Location pin — shown when hoverable */}
      {hasLocation && (
        <span style={{
          flexShrink: 0, fontSize: compact ? 9 : 10,
          color: active ? 'var(--sapphire-bright)' : 'var(--text-ghost)',
          transition: 'color 0.13s',
        }}>
          ◎
        </span>
      )}

      {/* Delta chip */}
      <span style={{
        flexShrink: 0, fontSize: compact ? 10.5 : 11, fontWeight: 800,
        color: deltaColor, padding: '2px 6px', borderRadius: 5,
        background: `color-mix(in srgb, ${deltaColor} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${deltaColor} 30%, transparent)`,
        fontFamily: 'var(--ff-mono, monospace)',
      }}>
        {deltaTxt}
      </span>
    </div>
  );
}

/**
 * Shows the top candidate moves from the most recent eval request.
 * Rendered inside the Analysis tab during live play (not replay).
 * `compact` collapses to a tighter layout for mobile/tablet.
 *
 * Hover (desktop) or tap (mobile) previews the move's target location on
 * the 3D board using the interaction store's preview state.
 * On mobile, tapping a located suggestion closes the drawer so the board
 * is visible. The highlight auto-clears after 3 s via `onLocationTap`.
 */
export function LiveSuggestions({
  compact = false,
  onLocationTap,
}: {
  compact?: boolean;
  onLocationTap?: () => void;
}) {
  const actionsPwin           = useGameStore(s => s.lastActionsPwin);
  const rawPwin               = useGameStore(s => s.lastRawPwin);
  const isEvaluating          = useGameStore(s => s.isEvaluating);
  const perspColor            = useGameStore(s => s.perspectiveColor);
  const humanIndices          = useGameStore(s => s.humanPlayerIndices);
  const gameState             = useGameStore(s => s.gameState);
  const setPreviewHighlight   = useInteractionStore(s => s.setPreviewHighlight);
  const clearPreviewHighlight = useInteractionStore(s => s.clearPreviewHighlight);

  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const isHumanTurn = humanIndices.includes(gameState?.current_player_index ?? -1);

  function applyHighlight(ap: ActionPwin): boolean {
    const hl = parseSuggestionHighlight(ap);
    if (!hl) return false;
    if (hl.type === 'road')   setPreviewHighlight(null, hl.edge, 'road');
    else if (hl.type === 'robber') setPreviewHighlight(null, null, null, hl.tileKey);
    else                      setPreviewHighlight(hl.nodeId, null, hl.type);
    return true;
  }

  function activateRow(idx: number, ap: ActionPwin) {
    const found = applyHighlight(ap);
    setActiveIdx(found ? idx : null);
    if (!found) clearPreviewHighlight();
  }

  function deactivateRow() {
    setActiveIdx(null);
    clearPreviewHighlight();
  }

  function tapRow(idx: number, ap: ActionPwin) {
    const found = applyHighlight(ap);
    setActiveIdx(found ? idx : null);
    if (found) onLocationTap?.(); // close drawer, GamePage handles auto-clear
  }

  if (isEvaluating && !actionsPwin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="eyebrow" style={{ marginBottom: 2 }}>Best Moves</div>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (!actionsPwin?.length) {
    return (
      <div style={{
        padding: compact ? '10px 0' : '14px 12px', textAlign: 'center',
        ...(compact ? {} : { borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hairline)' }),
        fontSize: 12, color: 'var(--text-ghost)',
      }}>
        {isHumanTurn ? 'Calculating best moves…' : 'Suggestions appear on your turn'}
      </div>
    );
  }

  const basePwin = perspColor ? (rawPwin?.[perspColor] ?? 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 5 : 6 }}>
      <div className="eyebrow" style={{ marginBottom: 2 }}>Best Moves</div>
      {actionsPwin.slice(0, 3).map((ap, i) => {
        const winFrac  = perspColor ? (ap.pwin_by_color[perspColor] ?? 0) : 0;
        const delta    = winFrac - basePwin;
        const deltaTxt = `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
        const hl       = parseSuggestionHighlight(ap);
        const label    = formatSuggestionLabel(ap);

        return (
          <SuggestionRow
            key={i}
            rank={i + 1}
            label={label}
            isTop={i === 0}
            deltaPositive={delta >= 0}
            deltaTxt={deltaTxt}
            hasLocation={hl !== null}
            active={activeIdx === i}
            compact={compact}
            onActivate={() => activateRow(i, ap)}
            onDeactivate={deactivateRow}
            onTap={compact ? () => tapRow(i, ap) : undefined}
          />
        );
      })}
      {!compact && (
        <div style={{ fontSize: 10.5, color: 'var(--text-ghost)', paddingLeft: 2 }}>
          Hover a move to preview its location on the board
        </div>
      )}
    </div>
  );
}

// ── Main AnalysisPanel ────────────────────────────────────────────────────────

export default function AnalysisPanel({ mobile = false }: { mobile?: boolean }) {
  const analysis = useGameStore(s => s.replayAnalysis);
  const loading  = useGameStore(s => s.replayAnalysisLoading);
  const isReplay = useGameStore(s => s.replayMode);

  // ── Live (non-replay) mode ────────────────────────────────────────────────
  if (!isReplay) {
    return <LiveSuggestions compact={mobile} />;
  }

  // ── Compact 2-column mobile layout (replay) ───────────────────────────────
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
      { label: 'Move Taken', accent: 'var(--amber)',            action: analysis.action_taken },
      { label: 'Best Move',  accent: 'var(--sapphire-bright)',  action: analysis.best_action  },
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
              padding: '5px 9px',
              borderBottom: `1px solid color-mix(in srgb, ${col.accent} 20%, transparent)`,
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

  // ── Desktop / tablet replay layout ────────────────────────────────────────
  const playerColor = analysis?.acting_player ?? null;
  const hex = playerColor ? (PLAYER_COLORS[playerColor as PlayerColor] ?? '#ccc') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Move Analysis
        </span>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="thinking-pulse"
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-ghost)' }}>
              Analyzing…
            </motion.span>
          ) : hex && playerColor ? (
            <motion.span key={playerColor}
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 6, color: hex, background: `${hex}18`, border: `1px solid ${hex}35` }}>
              {playerColor}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonCard />
            <SkeletonCard />
          </motion.div>
        ) : analysis ? (
          <motion.div key={analysis.step}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <ActionCard action={analysis.action_taken} label="Move Taken" accent="var(--amber)" playerColor={playerColor} />
            <ActionCard action={analysis.best_action}  label="Best Move"  accent="#4ade80"       playerColor={playerColor} />
            {analysis.win_probability_delta && <DeltaChip raw={analysis.win_probability_delta} />}
            {(analysis.explanation || analysis.explanation_error) && (
              <div style={{
                padding: '9px 10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)',
                fontSize: 11.5, lineHeight: 1.55,
                color: analysis.explanation_error ? 'var(--text-ghost)' : 'var(--text-dim)',
                fontStyle: analysis.explanation_error ? 'italic' : 'normal',
              }}>
                {analysis.explanation ?? analysis.explanation_error}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ padding: '14px 12px', borderRadius: 10, textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hairline)', fontSize: 12, color: 'var(--text-ghost)' }}>
            Analysis only available for human moves
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
