import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';
import clsx from 'clsx';

interface EvalBarProps {
  compact?: boolean;
}

export default function EvalBar({ compact = false }: EvalBarProps) {
  const lastPwin = useGameStore(s => s.lastPwin);
  const isEvaluating = useGameStore(s => s.isEvaluating);
  const gameState = useGameStore(s => s.gameState);
  const perspectiveColor = useGameStore(s => s.perspectiveColor);

  const players = gameState?.players || [];

  if (!gameState) return null;

  const colors: PlayerColor[] = players.map(p => p.color);

  const segments = colors.map(color => ({
    color,
    pwin: lastPwin?.[color] ?? (1 / colors.length),
    label: color,
  }));

  const perspectivePwin = perspectiveColor && lastPwin
    ? lastPwin[perspectiveColor]
    : null;

  return (
    <div className={clsx('select-none', compact ? 'p-1' : 'p-2')}>
      {/* Header */}
      <div className={clsx('flex items-center justify-between mb-1', compact ? 'text-[10px]' : 'text-xs')}>
        <span className="text-slate-400 font-medium tracking-wide uppercase">
          Win Probability
        </span>
        {isEvaluating && (
          <span className="text-slate-500 thinking-pulse text-[10px]">evaluating…</span>
        )}
        {perspectivePwin !== null && perspectivePwin !== undefined && (
          <span
            className="font-bold"
            style={{ color: PLAYER_COLORS[perspectiveColor!] }}
          >
            {Math.round(perspectivePwin * 100)}%
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="relative h-5 rounded-full overflow-hidden bg-slate-900 flex">
        {segments.map(({ color, pwin }, i) => (
          <motion.div
            key={color}
            className="eval-segment relative flex items-center justify-center overflow-hidden"
            style={{
              width: `${pwin * 100}%`,
              backgroundColor: PLAYER_COLORS[color] || '#666',
              opacity: !lastPwin ? 0.4 : 1,
            }}
            initial={false}
            animate={{ width: `${pwin * 100}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            title={`${color}: ${Math.round(pwin * 100)}%`}
          >
            {/* Shine */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            {/* Separator */}
            {i < segments.length - 1 && (
              <div className="absolute right-0 top-0 h-full w-px bg-black/30 z-10" />
            )}
            {/* Label */}
            {pwin > 0.1 && (
              <span className="relative z-10 text-[10px] font-bold text-white/90 drop-shadow-sm">
                {Math.round(pwin * 100)}%
              </span>
            )}
          </motion.div>
        ))}

        {/* Evaluating shimmer */}
        {isEvaluating && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Player labels */}
      {!compact && (
        <div className="flex mt-1">
          {segments.map(({ color, pwin }) => (
            <div
              key={color}
              className="flex items-center gap-1 transition-all duration-500"
              style={{ width: `${pwin * 100}%`, minWidth: 0 }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: PLAYER_COLORS[color] || '#666' }}
              />
              {pwin > 0.12 && (
                <span className="text-[10px] text-slate-400 truncate">{color}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
