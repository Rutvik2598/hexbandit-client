import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import type { GamePhase } from '@/shared/types/game';

interface PlacementHintProps {
  gamePhase: GamePhase | undefined;
  isHumanTurn: boolean;
  hasBuildSettlement: boolean;
  hasBuildRoad: boolean;
  replayMode: boolean;
  /** Pixels to inset from the right — matches AnnouncementBanner's rightOffset. */
  rightOffset?: number;
  /** Pixels from the top of the game container — matches AnnouncementBanner's topOffset. */
  topOffset?: number;
}

interface HintConfig {
  icon: 'settlement' | 'road';
  text: string;
  accent: string;
  shadow: string;
  border: string;
}

function getHint(hasBuildSettlement: boolean, hasBuildRoad: boolean): HintConfig | null {
  if (hasBuildSettlement) {
    return {
      icon: 'settlement',
      text: 'Place your settlement on a glowing circle',
      accent: 'var(--sapphire-bright)',
      shadow: 'rgba(63,135,242,0.35)',
      border: 'rgba(63,135,242,0.4)',
    };
  }
  if (hasBuildRoad) {
    return {
      icon: 'road',
      text: 'Place your road on a glowing edge',
      accent: 'var(--amber-soft)',
      shadow: 'rgba(240,169,58,0.35)',
      border: 'rgba(240,169,58,0.4)',
    };
  }
  return null;
}

export function PlacementHint({
  gamePhase,
  isHumanTurn,
  hasBuildSettlement,
  hasBuildRoad,
  replayMode,
  rightOffset = 0,
  topOffset = 74,
}: PlacementHintProps) {
  const isInitialBuild = gamePhase === 'INITIAL_BUILD';
  const hint = !replayMode && isInitialBuild && isHumanTurn
    ? getHint(hasBuildSettlement, hasBuildRoad)
    : null;

  // Each hint is only shown once per game session.
  const seen = useRef<Set<string>>(new Set());
  const hintKey = hint?.text ?? null;
  // eslint-disable-next-line react-hooks/refs
  const alreadySeen = hintKey !== null && seen.current.has(hintKey);

  useEffect(() => {
    if (!hintKey || seen.current.has(hintKey)) return;
    const id = setTimeout(() => { seen.current.add(hintKey); }, 1500);
    return () => clearTimeout(id);
  }, [hintKey]);

  const shouldShow = hint !== null && !alreadySeen;

  return (
    <AnimatePresence>
      {shouldShow && hint && (
        <motion.div
          key={hint.text}
          initial={{ opacity: 0, y: -20, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            top: topOffset,
            left: 0,
            right: rightOffset,
            zIndex: 43,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(6,11,21,0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${hint.border}`,
            borderRadius: 10,
            boxShadow: `0 4px 20px -6px ${hint.shadow}`,
            whiteSpace: 'nowrap',
          }}>
            <Icon name={hint.icon} size={14} color={hint.accent} strokeWidth={1.8} />
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'var(--ff-display)',
              letterSpacing: '0.04em',
              color: hint.accent,
            }}>
              {hint.text}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
