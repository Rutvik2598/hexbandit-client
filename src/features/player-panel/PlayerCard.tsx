import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import { ImgIcon } from '@/shared/components/ResourceIcon';
import { PLAYER_COLORS } from '@/shared/constants';
import type { Player, PlayerColor } from '@/shared/types/game';

interface PlayerCardProps {
  player: Player;
  isCurrentTurn: boolean;
  isHumanPlayer: boolean;
  pwin?: number | null;
  compact?: boolean;
  resourceGains?: Partial<Record<string, number>>;
  isThinking?: boolean;
}

const WAVEFORM_DELAYS = [0, 0.18, 0.09, 0.27, 0.15];

function ThinkingWaveform({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 14 }}>
      {WAVEFORM_DELAYS.map((delay, i) => (
        <motion.div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: color,
            originY: 1,
          }}
          animate={{ height: ['4px', '14px', '4px'] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay }}
        />
      ))}
    </div>
  );
}

export default function PlayerCard({
  player,
  isCurrentTurn,
  isHumanPlayer,
  pwin,
  resourceGains: _resourceGains,
  isThinking = false,
}: PlayerCardProps) {
  const color = player.color as PlayerColor;
  const hex   = PLAYER_COLORS[color] || '#ccc';

  const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      style={{
        position: 'relative',
        padding: '12px 13px',
        borderRadius: 'var(--r-md)',
        background: isCurrentTurn
          ? `color-mix(in srgb, ${hex} 13%, var(--glass-2))`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isCurrentTurn ? hex : 'var(--hairline)'}`,
        // CSS custom property for the turnPulse animation
        ['--ring-c' as string]: hex,
        transition: 'background 0.2s',
      }}
      animate={isCurrentTurn ? {
        boxShadow: isThinking ? [
          `0 0 0 1px ${hex}, 0 0 28px 2px ${hex}`,
          `0 0 0 1px ${hex}, 0 0 48px 8px ${hex}`,
          `0 0 0 1px ${hex}, 0 0 28px 2px ${hex}`,
        ] : [
          `0 0 0 1px ${hex}, 0 0 18px -2px ${hex}`,
          `0 0 0 1px ${hex}, 0 0 34px 2px ${hex}`,
          `0 0 0 1px ${hex}, 0 0 18px -2px ${hex}`,
        ],
      } : { boxShadow: 'none' }}
      transition={{ duration: isThinking ? 1.2 : 2.4, repeat: isCurrentTurn ? Infinity : 0, ease: 'easeInOut' }}
    >
      {/* top row: color dot + name + turn badge + VP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {/* colour dot */}
        <span style={{
          width: 11, height: 11, borderRadius: '50%', background: hex, flexShrink: 0,
          boxShadow: `0 0 9px ${hex}`,
          border: color === 'WHITE' ? '1px solid rgba(0,0,0,0.3)' : 'none',
        }} />

        {/* name + badges */}
        <span className="truncate" style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)', flex: 1, minWidth: 0 }}>
          {player.name}
        </span>
        {isHumanPlayer && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-faint)',
            padding: '2px 6px', borderRadius: 5,
            background: 'rgba(255,255,255,0.05)', textTransform: 'uppercase',
          }}>You</span>
        )}
        {isCurrentTurn && (
          <motion.span
            style={{
              marginLeft: 'auto',
              fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', color: hex,
              textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            animate={isThinking ? {} : { opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            {isThinking
              ? <ThinkingWaveform color={hex} />
              : <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, boxShadow: `0 0 8px ${hex}` }} />
                  Turn
                </>
            }
          </motion.span>
        )}

        {/* VP */}
        <span style={{
          marginLeft: isCurrentTurn ? 8 : 'auto',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 18,
          color: 'var(--amber-soft)',
        }}>
          <Icon name="star" size={14} color="var(--amber)" />
          {player.victory_points}
        </span>
      </div>

      {/* second row: cards / dev / badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, paddingLeft: 20 }}>
        {/* card count */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
          <Icon name="cards" size={13} color="var(--text-faint)" />
          {isHumanPlayer ? totalCards : (player as Player & { cards?: number }).cards ?? totalCards}
        </span>

        {/* dev count */}
        {player.num_dev_cards > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
            <Icon name="devcard" size={13} color="var(--text-faint)" />
            {player.num_dev_cards}
          </span>
        )}

        {/* knights */}
        {player.knights_played > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--text-faint)' }}>
            <ImgIcon name="knight" size={13} />
            {player.knights_played}
          </span>
        )}

        {/* pwin */}
        {pwin !== null && pwin !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', marginLeft: 'auto' }}>
            {Math.round(pwin * 100)}%
          </span>
        )}

        {/* special badges */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {player.has_longest_road && (
            <span title="Longest Road" style={{ display: 'grid', placeItems: 'center' }}>
              <ImgIcon name="longest_road" size={24} />
            </span>
          )}
          {player.has_largest_army && (
            <span title="Largest Army" style={{ display: 'grid', placeItems: 'center' }}>
              <ImgIcon name="largest_army" size={24} />
            </span>
          )}
        </div>
      </div>

    </motion.div>
  );
}
