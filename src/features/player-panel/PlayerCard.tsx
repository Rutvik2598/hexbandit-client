import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  PLAYER_COLORS,
  PLAYER_COLORS_BG,
  RESOURCE_EMOJI,
  RESOURCE_ORDER,
} from '@/shared/constants';
import type { Player, PlayerColor } from '@/shared/types/game';

interface PlayerCardProps {
  player: Player;
  isCurrentTurn: boolean;
  isHumanPlayer: boolean;
  pwin?: number | null;
  compact?: boolean;
  resourceGains?: Partial<Record<string, number>> | null;
}

const ROAD = '🛤️';
const SWORD = '⚔️';

export default function PlayerCard({
  player,
  isCurrentTurn,
  isHumanPlayer,
  pwin,
  compact = false,
  resourceGains,
}: PlayerCardProps) {
  const color = player.color as PlayerColor;
  const playerColor = PLAYER_COLORS[color] || '#ccc';
  const playerBg = PLAYER_COLORS_BG[color] || 'rgba(255,255,255,0.05)';

  const totalResources = Object.values(player.resources).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      className={clsx(
        'rounded-xl border transition-all duration-200',
        'backdrop-blur-sm',
        isCurrentTurn
          ? 'border-opacity-60 shadow-lg'
          : 'border-slate-700/50',
      )}
      style={{
        backgroundColor: isCurrentTurn ? playerBg : 'rgba(15,20,35,0.6)',
        borderColor: isCurrentTurn ? playerColor : undefined,
        boxShadow: isCurrentTurn ? `0 0 20px ${playerColor}30` : undefined,
      }}
      animate={isCurrentTurn ? { scale: [1, 1.01, 1] } : { scale: 1 }}
      transition={{ duration: 2, repeat: isCurrentTurn ? Infinity : 0 }}
    >
      <div className={clsx('p-3', compact && 'p-2')}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Color dot */}
            <div
              className="w-3 h-3 rounded-full ring-2 ring-black/30 flex-shrink-0"
              style={{ backgroundColor: playerColor }}
            />
            <div>
              <div className="flex items-center gap-1">
                <span className={clsx('font-semibold text-sm', compact && 'text-xs')} style={{ color: playerColor }}>
                  {player.name}
                </span>
                {isHumanPlayer && (
                  <span className="text-[9px] bg-slate-700 text-slate-300 px-1 rounded">You</span>
                )}
                {isCurrentTurn && (
                  <motion.span
                    className="text-[9px] px-1 rounded font-bold"
                    style={{ backgroundColor: playerColor + '30', color: playerColor }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    ▶ Turn
                  </motion.span>
                )}
              </div>
            </div>
          </div>

          {/* VP */}
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">VP</span>
              <span className={clsx('font-bold', compact ? 'text-sm' : 'text-base')} style={{ color: playerColor }}>
                {player.victory_points}
              </span>
            </div>
            {/* Pwin */}
            {pwin !== null && pwin !== undefined && (
              <div className="text-[10px] text-slate-400">
                {Math.round(pwin * 100)}% win
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
          <span title="Settlements">🏠 {player.settlements}</span>
          <span title="Cities">🏰 {player.cities}</span>
          <span title="Roads">🛤️ {player.roads_built}</span>
          {player.has_longest_road && (
            <span className="text-yellow-400" title="Longest Road">{ROAD} LR</span>
          )}
          {player.has_largest_army && (
            <span className="text-purple-400" title="Largest Army">{SWORD} LA</span>
          )}
        </div>

        {/* Resources */}
        {!compact && (
          <div className="mb-2">
            <div className="flex items-center gap-1 flex-wrap">
              {RESOURCE_ORDER.map(res => {
                const count = player.resources[res];
                const gain = resourceGains?.[res];
                if (count === 0 && !isHumanPlayer && !gain) return null;
                return (
                  <div key={res} className="relative">
                    <div
                      className={clsx(
                        'flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md transition-all',
                        count > 0 ? 'bg-slate-700/70' : 'bg-slate-800/30 opacity-40',
                        gain && 'ring-1 ring-green-400/60 bg-green-900/30',
                      )}
                      title={res}
                    >
                      <span>{RESOURCE_EMOJI[res]}</span>
                      <span className="font-mono font-bold text-slate-200">{count}</span>
                    </div>
                    <AnimatePresence>
                      {gain && (
                        <motion.span
                          key={`gain-${res}`}
                          initial={{ opacity: 0, y: 0, scale: 0.8 }}
                          animate={{ opacity: 1, y: -14, scale: 1 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                          className="absolute -top-1 -right-1 text-[9px] font-bold text-green-300 bg-green-900/80 border border-green-500/50 rounded px-0.5 leading-tight pointer-events-none"
                        >
                          +{gain}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {!isHumanPlayer && totalResources > 0 && (
                <div className="text-xs text-slate-500">
                  {totalResources} cards
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dev cards */}
        {!compact && (player.num_dev_cards > 0 || Object.values(player.dev_cards_played).some(v => v > 0)) && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {player.num_dev_cards > 0 && (
              <span>📜 {player.num_dev_cards} in hand</span>
            )}
            {player.knights_played > 0 && (
              <span>⚔️ {player.knights_played} knights</span>
            )}
          </div>
        )}

        {/* Ports */}
        {!compact && player.port_resources.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {player.port_resources.map((port, i) => (
              <span key={i} className="text-[10px] bg-blue-900/30 text-blue-300 px-1 rounded">
                {port ? `${RESOURCE_EMOJI[port]} 2:1` : '⚓ 3:1'}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
