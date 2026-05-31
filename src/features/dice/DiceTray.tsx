/**
 * DiceTray — two physical dice with pip grid layout and a tumble animation
 * while the roll is in flight, settling on the server-returned values.
 *
 * Animation strategy: the Die key includes both rollKey and the rolling boolean.
 * Any rolling-state change (human or bot roll) unmounts+remounts the Die with a
 * brand-new DOM element, so animationName is declared in the React style from the
 * very first paint — no imperative reflow tricks needed.
 */
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
}

function Die({ value, rolling, delayMs }: DieProps) {
  const face = Math.max(1, Math.min(6, value));

  return (
    <div
      style={{
        width: 58,
        height: 58,
        borderRadius: 13,
        position: 'relative',
        background: 'linear-gradient(150deg,#ffffff,#d8e0ee)',
        boxShadow: '0 10px 22px -6px rgba(0,0,0,0.65), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 6px rgba(80,100,140,0.35)',
        border: '1px solid rgba(255,255,255,0.6)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gridTemplateRows: 'repeat(3,1fr)',
        padding: 8,
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
              width: 10,
              height: 10,
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
}

export function DiceTray({ dice, rolling, rollKey = 0 }: DiceTrayProps) {
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
      if (dice) setDisplay(dice);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [rolling, dice]);

  const total = display[0] + display[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'flex', gap: 12,
        filter: rolling ? 'blur(0.3px)' : 'none',
        transition: 'filter 0.15s',
      }}>
        <Die key={`d0-${rollKey}-${rolling}`} value={display[0]} rolling={rolling} delayMs={0} />
        <Die key={`d1-${rollKey}-${rolling}`} value={display[1]} rolling={rolling} delayMs={120} />
      </div>
      <div style={{
        fontFamily: 'var(--ff-display)',
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: '0.04em',
        color: rolling
          ? 'var(--text-faint)'
          : dice
          ? 'var(--amber-soft)'
          : 'var(--text-faint)',
        textShadow: (!rolling && dice) ? '0 0 16px var(--amber-glow)' : 'none',
        minHeight: 18,
        transition: 'color 0.2s',
      }}>
        {rolling ? 'Rolling…' : dice ? `Rolled ${total}` : 'Awaiting roll'}
      </div>
    </div>
  );
}
