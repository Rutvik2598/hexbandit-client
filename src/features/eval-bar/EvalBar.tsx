import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

interface EvalBarProps {
  compact?: boolean;
}

export default function EvalBar({ compact = false }: EvalBarProps) {
  const lastPwin        = useGameStore(s => s.lastPwin);
  const isEvaluating    = useGameStore(s => s.isEvaluating);
  const gameState       = useGameStore(s => s.gameState);
  const perspectiveColor = useGameStore(s => s.perspectiveColor);

  if (!gameState) return null;

  const players = gameState.players;
  const n = players.length || 1;

  const segments = players.map(p => ({
    color: p.color as PlayerColor,
    pct:   (lastPwin?.[p.color] ?? 1 / n) * 100,
    name:  p.name,
  }));

  const leadIdx = segments.reduce((m, s, i) => s.pct > segments[m].pct ? i : m, 0);
  const perspPct = perspectiveColor && lastPwin
    ? Math.round((lastPwin[perspectiveColor] ?? 0) * 100)
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      <span
        className="eyebrow"
        style={{ flexShrink: 0, letterSpacing: '0.14em', fontSize: compact ? 9 : 10 }}
      >
        Win&nbsp;Odds
      </span>

      {/* bar */}
      <div style={{
        flex: 1, display: 'flex', height: compact ? 18 : 22, borderRadius: 7, overflow: 'hidden',
        border: '1px solid var(--glass-brd)', background: 'var(--bg-0)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
        position: 'relative',
      }}>
        {segments.map(({ color, pct, name }, i) => {
          const c = PLAYER_COLORS[color] || '#666';
          const isLead = i === leadIdx;
          const showPct = pct >= 11;
          return (
            <motion.div
              key={color}
              title={`${name} · ${Math.round(pct)}%`}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(180deg, color-mix(in srgb, ${c} 92%, #fff) 0%, ${c} 55%, color-mix(in srgb, ${c} 80%, #000) 100%)`,
                borderRight: i < segments.length - 1 ? '1.5px solid rgba(6,11,21,0.85)' : 'none',
                boxShadow: isLead ? `inset 0 0 12px ${c}, inset 0 0 0 1px rgba(255,255,255,0.35)` : 'none',
                overflow: 'hidden',
              }}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* shine */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(255,255,255,0.18),transparent)' }} />
              {showPct && (
                <span style={{
                  fontSize: compact ? 9 : 11, fontWeight: 800, letterSpacing: '0.01em',
                  color: color === 'WHITE' ? '#1a2433' : '#fff',
                  textShadow: color === 'WHITE' ? 'none' : '0 1px 2px rgba(0,0,0,0.45)',
                  whiteSpace: 'nowrap', position: 'relative', zIndex: 1,
                }}>
                  {Math.round(pct)}%
                </span>
              )}
            </motion.div>
          );
        })}

        {/* evaluating shimmer */}
        {isEvaluating && (
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',
              pointerEvents: 'none',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* perspective pwin badge */}
      {perspPct !== null && perspectiveColor && (
        <span style={{
          fontSize: compact ? 10 : 12, fontWeight: 800, flexShrink: 0,
          color: PLAYER_COLORS[perspectiveColor] || 'var(--text)',
        }}>
          {perspPct}%
        </span>
      )}
    </div>
  );
}
