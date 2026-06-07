import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { RecordingFrame, PlayerColor } from '@/shared/types/game';

interface Milestone {
  frameIndex: number;
  turn: number;
  color: string;
  icon: string;
  label: string;
}

const MILESTONE_TYPES = new Set([
  'BUILD_SETTLEMENT',
  'BUILD_CITY',
  'BUILD_ROAD',
  'BUY_DEVELOPMENT_CARD',
  'PLAY_KNIGHT_CARD',
  'PLAY_YEAR_OF_PLENTY',
  'PLAY_MONOPOLY',
  'PLAY_ROAD_BUILDING',
  'MARITIME_TRADE',
  'MOVE_ROBBER',
]);

const ICONS: Record<string, string> = {
  BUILD_SETTLEMENT:   '🏠',
  BUILD_CITY:         '🏙',
  BUILD_ROAD:         '🛣',
  BUY_DEVELOPMENT_CARD: '🃏',
  PLAY_KNIGHT_CARD:   '⚔',
  PLAY_YEAR_OF_PLENTY:'🌾',
  PLAY_MONOPOLY:      '💰',
  PLAY_ROAD_BUILDING: '🔨',
  MARITIME_TRADE:     '⚓',
  MOVE_ROBBER:        '🦹',
};

const LABELS: Record<string, string> = {
  BUILD_SETTLEMENT:   'Built settlement',
  BUILD_CITY:         'Built city',
  BUILD_ROAD:         'Built road',
  BUY_DEVELOPMENT_CARD: 'Bought dev card',
  PLAY_KNIGHT_CARD:   'Played knight',
  PLAY_YEAR_OF_PLENTY:'Year of Plenty',
  PLAY_MONOPOLY:      'Monopoly',
  PLAY_ROAD_BUILDING: 'Road Building',
  MARITIME_TRADE:     'Traded at port',
  MOVE_ROBBER:        'Moved robber',
};

function getMilestones(frames: RecordingFrame[]): Milestone[] {
  const milestones: Milestone[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const action = frame.action;
    if (!action || !MILESTONE_TYPES.has(action.action_type)) continue;
    milestones.push({
      frameIndex: i,
      turn: frame.turn ?? 0,
      color: action.color,
      icon: ICONS[action.action_type] ?? '•',
      label: action.description || LABELS[action.action_type] || action.action_type,
    });
  }
  return milestones;
}

interface Props {
  onJump: (frameIndex: number) => void;
}

export default function MoveHistoryTimeline({ onJump }: Props) {
  const replayFrames = useGameStore(s => s.replayFrames);
  const replayStep   = useGameStore(s => s.replayStep);

  const milestones = getMilestones(replayFrames);
  const activeRef  = useRef<HTMLButtonElement | null>(null);

  // Find which milestone is at or just before the current step
  let activeIdx = -1;
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (milestones[i].frameIndex <= replayStep) { activeIdx = i; break; }
  }

  const handleClick = useCallback((frameIndex: number) => {
    onJump(frameIndex);
  }, [onJump]);

  // Scroll active item into view when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  if (milestones.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        fontFamily: 'var(--ff-display)', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--text-ghost)', paddingBottom: 6,
      }}>
        Move History
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {milestones.map((m, i) => {
          const isActive = i === activeIdx;
          const dotColor = PLAYER_COLORS[m.color as PlayerColor] ?? '#888';
          return (
            <button
              key={m.frameIndex}
              ref={isActive ? activeRef : null}
              onClick={() => handleClick(m.frameIndex)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 7, border: 'none',
                background: isActive
                  ? 'rgba(63,135,242,0.12)'
                  : 'transparent',
                outline: isActive ? '1px solid rgba(63,135,242,0.3)' : 'none',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* Player color dot */}
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: dotColor,
                boxShadow: isActive ? `0 0 6px ${dotColor}` : 'none',
              }} />

              {/* Icon */}
              <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0, width: 16, textAlign: 'center' }}>
                {m.icon}
              </span>

              {/* Label */}
              <span style={{
                fontSize: 11.5, fontWeight: isActive ? 700 : 600,
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {m.label}
              </span>

              {/* Turn number */}
              <span style={{
                fontSize: 10, fontWeight: 700, flexShrink: 0,
                color: isActive ? 'var(--text-faint)' : 'var(--text-ghost)',
                fontFamily: 'var(--ff-display)',
              }}>
                T{m.turn}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
