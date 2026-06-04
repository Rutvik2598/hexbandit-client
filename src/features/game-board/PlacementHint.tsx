import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import type { InteractionMode } from '@/store/interactionStore';
import type { GamePhase } from '@/shared/types/game';
import type { Breakpoint } from '@/shared/hooks/useBreakpoint';

interface PlacementHintProps {
  mode: InteractionMode;
  gamePhase: GamePhase | undefined;
  isHumanTurn: boolean;
  hasBuildSettlement: boolean;
  hasBuildRoad: boolean;
  bp: Breakpoint;
}

interface HintConfig {
  icon: 'settlement' | 'road';
  text: string;
  accent: string;
}

function getHint(hasBuildSettlement: boolean, hasBuildRoad: boolean): HintConfig | null {
  if (hasBuildSettlement) {
    return {
      icon: 'settlement',
      text: 'Place your settlement on a glowing circle',
      accent: 'var(--sapphire-bright)',
    };
  }
  if (hasBuildRoad) {
    return {
      icon: 'road',
      text: 'Place your road on a glowing edge',
      accent: 'var(--amber-soft)',
    };
  }
  return null;
}

export function PlacementHint({ gamePhase, isHumanTurn, hasBuildSettlement, hasBuildRoad, bp }: PlacementHintProps) {
  const isInitialBuild = gamePhase === 'INITIAL_BUILD';
  const hint = isInitialBuild && isHumanTurn
    ? getHint(hasBuildSettlement, hasBuildRoad)
    : null;

  // Track which hints have been shown — each key is only shown once per game
  const seen = useRef<Set<string>>(new Set());
  const hintKey = hint?.text ?? null;
  const alreadySeen = hintKey !== null && seen.current.has(hintKey);

  // Mark a hint as seen only after it has been on screen for a moment.
  // Without the delay, a same-frame re-render (e.g. setMode firing right after
  // hasBuildRoad becomes true) would mark it seen before the browser paints.
  useEffect(() => {
    if (!hintKey || seen.current.has(hintKey)) return;
    const id = setTimeout(() => { seen.current.add(hintKey); }, 1500);
    return () => clearTimeout(id);
  }, [hintKey]);

  const shouldShow = hint !== null && !alreadySeen;

  const isMobile = bp === 'mobile';
  const bottomOffset = isMobile ? 100 : 28;

  return (
    <AnimatePresence>
      {shouldShow && hint && (
        <motion.div
          key={hint.text}
          initial={{ opacity: 0, y: 10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 6, x: '-50%' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            bottom: bottomOffset,
            left: '50%',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: isMobile ? '8px 14px' : '9px 16px',
            borderRadius: 999,
            background: 'rgba(8,16,30,0.82)',
            border: '1px solid rgba(125,165,225,0.18)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 4px 24px -8px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Pulse dot */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: hint.accent,
            boxShadow: `0 0 6px ${hint.accent}`,
            animation: 'thinking-pulse 2s ease-in-out infinite',
          }} />

          <Icon name={hint.icon} size={isMobile ? 13 : 14} color={hint.accent} strokeWidth={1.8} />

          <span style={{
            fontSize: isMobile ? 11.5 : 12.5,
            fontWeight: 600,
            color: 'var(--text-dim)',
            letterSpacing: '0.01em',
          }}>
            {hint.text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
