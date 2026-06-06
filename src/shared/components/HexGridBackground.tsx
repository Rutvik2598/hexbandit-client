import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const R = 40;
const sqrt3 = Math.sqrt(3);
const COL_W = sqrt3 * R;       // ~69.3 — horizontal spacing between pointy-top hex centers
const ROW_H = 1.5 * R;         // 60    — vertical spacing between hex centers
const ODD_OFFSET = 0.75 * R;   // 30    — downward shift for odd columns

const COLS = 26;
const ROWS = 17;
const VW = COLS * COL_W + COL_W;
const VH = ROWS * ROW_H + ODD_OFFSET + R;

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6; // pointy-top
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

interface HexCell { id: string; cx: number; cy: number }

function buildGrid(): HexCell[] {
  const cells: HexCell[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const cx = col * COL_W + COL_W / 2;
      const cy = row * ROW_H + (col % 2 === 1 ? ODD_OFFSET : 0) + R;
      cells.push({ id: `${col}-${row}`, cx, cy });
    }
  }
  return cells;
}

const GRID = buildGrid();

export function HexGridBackground() {
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const pulse = () => {
      const count = 2 + Math.floor(Math.random() * 4);
      const ids = new Set<string>();
      while (ids.size < count) {
        ids.add(GRID[Math.floor(Math.random() * GRID.length)].id);
      }
      setActiveIds(ids);
      setTimeout(() => setActiveIds(new Set()), 600 + Math.random() * 900);
      timer = setTimeout(pulse, 1200 + Math.random() * 1600);
    };

    timer = setTimeout(pulse, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}
    >
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${VW.toFixed(0)} ${VH.toFixed(0)}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <radialGradient id="hgbFade" cx="50%" cy="48%" r="52%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="80%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="hgbMask">
            <rect width="100%" height="100%" fill="url(#hgbFade)" />
          </mask>
          <filter id="hgbGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base grid */}
        <g mask="url(#hgbMask)">
          {GRID.map(({ id, cx, cy }) => (
            <polygon
              key={id}
              points={hexPoints(cx, cy, R - 1.5)}
              fill="transparent"
              stroke="rgba(125,165,225,0.10)"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Animated glow hexes */}
        <g mask="url(#hgbMask)">
          <AnimatePresence>
            {GRID.filter(h => activeIds.has(h.id)).map(({ id, cx, cy }) => (
              <motion.polygon
                key={`glow-${id}`}
                points={hexPoints(cx, cy, R - 1.5)}
                fill="rgba(47,116,240,0.11)"
                stroke="rgba(79,141,255,0.55)"
                strokeWidth="1.5"
                filter="url(#hgbGlow)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            ))}
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
}
