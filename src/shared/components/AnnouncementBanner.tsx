import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

export interface AchievementData {
  type: 'largest_army' | 'longest_road';
  playerName: string;
  playerColor: PlayerColor;
}

const META = {
  largest_army: { icon: '⚔️', label: 'Largest Army' },
  longest_road: { icon: '🛤️', label: 'Longest Road' },
} as const;

interface Props {
  achievement: AchievementData | null;
  yourTurn: boolean;
  rightOffset?: number;
  topOffset?: number;
  compact?: boolean;
}

export function AnnouncementBanner({ achievement, yourTurn, rightOffset = 0, topOffset = 74, compact = false }: Props) {
  const accentColor = achievement
    ? (PLAYER_COLORS[achievement.playerColor] ?? 'var(--amber)')
    : 'var(--amber)';

  const containerBase: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: rightOffset,
    zIndex: 45,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'center',
  };

  return (
    <>
      {/* Largest Army / Longest Road achievement */}
      <AnimatePresence>
        {achievement && (
          <motion.div
            key={achievement.type + achievement.playerColor}
            initial={{ opacity: 0, y: -28, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.94 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{ ...containerBase, top: topOffset }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: compact ? 8 : 12,
              padding: compact ? '7px 12px' : '11px 20px',
              background: 'rgba(6,11,21,0.90)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: `1px solid ${accentColor}55`,
              borderRadius: compact ? 10 : 14,
              boxShadow: `0 8px 32px -8px ${accentColor}55, 0 2px 8px rgba(0,0,0,0.5)`,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: compact ? 14 : 20 }}>{META[achievement.type].icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{
                  fontSize: compact ? 9 : 10.5, fontWeight: 800, letterSpacing: '0.09em',
                  textTransform: 'uppercase', color: accentColor,
                }}>
                  {achievement.playerName}
                </span>
                <span style={{
                  fontSize: compact ? 11 : 15, fontWeight: 800, color: '#fff',
                  fontFamily: 'var(--ff-display)',
                }}>
                  {META[achievement.type].label}
                </span>
              </div>
              <span style={{
                fontSize: compact ? 8.5 : 10, fontWeight: 800, letterSpacing: '0.12em',
                padding: compact ? '2px 6px' : '3px 9px', borderRadius: 5,
                background: `${accentColor}22`,
                border: `1px solid ${accentColor}55`,
                color: accentColor,
                marginLeft: 4,
              }}>
                +2 VP
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Your Turn toast */}
      <AnimatePresence>
        {yourTurn && (
          <motion.div
            key="your-turn"
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ ...containerBase, top: achievement ? topOffset + 56 : topOffset, zIndex: 44 }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: compact ? 5 : 8,
              padding: compact ? '5px 10px' : '8px 16px',
              background: 'rgba(6,11,21,0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(240,169,58,0.4)',
              borderRadius: compact ? 8 : 10,
              boxShadow: '0 4px 20px -6px rgba(240,169,58,0.4)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: compact ? 11 : 15 }}>🎲</span>
              <span style={{
                fontSize: compact ? 10.5 : 13, fontWeight: 800,
                fontFamily: 'var(--ff-display)',
                letterSpacing: '0.06em',
                color: 'var(--amber-soft)',
              }}>
                Your Turn
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
