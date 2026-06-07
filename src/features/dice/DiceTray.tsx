// Die key includes rollKey + rolling boolean so any rolling-state change (human or bot)
// unmounts+remounts the Die, ensuring animationName is declared from the very first paint.
import { useState, useEffect, useRef } from 'react';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface DieProps {
  value: number;
  rolling: boolean;
  delayMs: number;
  compact?: boolean;
}

function Die({ value, rolling, delayMs, compact }: DieProps) {
  const face = Math.max(1, Math.min(6, value));
  const sz  = compact ? 40 : 58;
  const br  = compact ? 9  : 13;
  const pd  = compact ? 5  : 8;
  const pip = compact ? 7  : 10;

  return (
    <div
      style={{
        width: sz, height: sz, borderRadius: br, padding: pd,
        position: 'relative',
        background: 'linear-gradient(150deg,#ffffff,#d8e0ee)',
        boxShadow: '0 10px 22px -6px rgba(0,0,0,0.65), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 6px rgba(80,100,140,0.35)',
        border: '1px solid rgba(255,255,255,0.6)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gridTemplateRows: 'repeat(3,1fr)',
        gap: 0,
        animationName: rolling ? 'tumble' : 'none',
        animationDuration: '0.42s',
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDelay: `${delayMs}ms`,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center' }}>
          {PIPS[face].includes(i) && (
            <div style={{
              width: pip, height: pip,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #3a4a66, #0e1830)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25)',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export interface DiceTrayProps {
  dice: [number, number] | null;
  rolling: boolean;
  /** Increments on every new roll — used as part of the Die key to force remount. */
  rollKey?: number;
  compact?: boolean;
}

export function DiceTray({ dice, rolling, rollKey = 0, compact }: DiceTrayProps) {
  const [display, setDisplay] = useState<[number, number]>(dice ?? [1, 1]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rolling) {
      intervalRef.current = setInterval(() => {
        setDisplay([
          1 + Math.floor(Math.random() * 6),
          1 + Math.floor(Math.random() * 6),
        ]);
      }, 90);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (dice) setDisplay(dice);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [rolling, dice]);

  const total = display[0] + display[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 6 : 10 }}>
      <div style={{
        display: 'flex', gap: compact ? 8 : 12,
        filter: rolling ? 'blur(0.3px)' : 'none',
        transition: 'filter 0.15s',
      }}>
        <Die key={`d0-${rollKey}-${rolling}`} value={display[0]} rolling={rolling} delayMs={0} compact={compact} />
        <Die key={`d1-${rollKey}-${rolling}`} value={display[1]} rolling={rolling} delayMs={120} compact={compact} />
      </div>
      <div style={{
        fontFamily: 'var(--ff-display)',
        fontWeight: 700,
        fontSize: compact ? 11 : 14,
        letterSpacing: '0.04em',
        color: rolling
          ? 'var(--text-faint)'
          : dice
          ? 'var(--amber-soft)'
          : 'var(--text-faint)',
        textShadow: (!rolling && dice) ? '0 0 16px var(--amber-glow)' : 'none',
        minHeight: compact ? 14 : 18,
        transition: 'color 0.2s',
      }}>
        {rolling ? 'Rolling…' : dice ? `Rolled ${total}` : 'Awaiting roll'}
      </div>
    </div>
  );
}
