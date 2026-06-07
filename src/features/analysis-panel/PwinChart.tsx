import { useRef, useState, useCallback, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

// ── Layout constants (viewBox units) ──────────────────────────────────────────
const VW     = 280;   // viewBox width
const CH     = 80;    // chart draw-area height
const PAD_T  = 8;
const PAD_B  = 18;    // room for x-axis turn labels
const PAD_L  = 26;    // room for y-axis % labels
const PAD_R  = 6;
const VH     = PAD_T + CH + PAD_B;
const CW     = VW - PAD_L - PAD_R;

interface DataPoint {
  frameIndex: number;
  turn: number;
  pwin: Record<string, number>;
}

interface TooltipData {
  x: number;        // viewBox x
  frameIndex: number;
  pwin: Record<string, number>;
}

interface Props {
  onJump: (frameIndex: number) => void;
}

// Map frame index → viewBox x
function fi2x(fi: number, maxFi: number): number {
  return PAD_L + (maxFi > 0 ? fi / maxFi : 0) * CW;
}

// Map pwin [0,1] → viewBox y (inverted: 1 = top)
function pw2y(pwin: number): number {
  return PAD_T + (1 - pwin) * CH;
}

export default function PwinChart({ onJump }: Props) {
  const replayFrames = useGameStore(s => s.replayFrames);
  const replayStep   = useGameStore(s => s.replayStep);
  const gameState    = useGameStore(s => s.gameState);

  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Build data points from frames that have pwin evaluation data
  const points = useMemo<DataPoint[]>(() => {
    const out: DataPoint[] = [];
    for (let i = 0; i < replayFrames.length; i++) {
      const pwin = replayFrames[i].evaluate?.pwin_by_color;
      if (pwin && Object.keys(pwin).length > 0) {
        out.push({ frameIndex: i, turn: replayFrames[i].turn ?? 0, pwin });
      }
    }
    return out;
  }, [replayFrames]);

  const maxFi = replayFrames.length - 1;

  // Convert a mouse event x to viewBox x, accounting for SVG scaling
  const mouseToVbX = useCallback((clientX: number): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return PAD_L;
    const frac = (clientX - rect.left) / rect.width;
    return frac * VW;
  }, []);

  // Find the nearest data point to a given viewBox x
  const nearestPoint = useCallback((vbX: number): DataPoint | null => {
    if (points.length === 0) return null;
    const targetFi = Math.round(((vbX - PAD_L) / CW) * maxFi);
    return points.reduce((best, pt) =>
      Math.abs(pt.frameIndex - targetFi) < Math.abs(best.frameIndex - targetFi) ? pt : best
    );
  }, [points, maxFi]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const vbX = mouseToVbX(e.clientX);
    if (vbX < PAD_L || vbX > PAD_L + CW) { setTooltip(null); return; }
    const pt = nearestPoint(vbX);
    if (pt) setTooltip({ x: fi2x(pt.frameIndex, maxFi), frameIndex: pt.frameIndex, pwin: pt.pwin });
  }, [mouseToVbX, nearestPoint, maxFi]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const pt = nearestPoint(mouseToVbX(e.clientX));
    if (pt) onJump(pt.frameIndex);
  }, [mouseToVbX, nearestPoint, onJump]);

  // Hooks must be called before any early return
  const players = useMemo(() => gameState?.players ?? [], [gameState]);

  // ── X-axis turn labels: up to 5 evenly spaced ────────────────────────────
  const xLabels = useMemo(() => {
    if (points.length === 0) return [];
    const maxTurn = points[points.length - 1].turn;
    const interval = Math.ceil(maxTurn / 4);
    const labels: { x: number; label: string }[] = [];
    for (let t = 0; t <= maxTurn; t += interval) {
      const pt = points.find(p => p.turn >= t) ?? points[points.length - 1];
      labels.push({ x: fi2x(pt.frameIndex, maxFi), label: `T${t}` });
    }
    return labels;
  }, [points, maxFi]);

  // ── Per-player SVG paths ──────────────────────────────────────────────────
  const paths = useMemo(() => players.map(player => {
    const hex = PLAYER_COLORS[player.color as PlayerColor] || '#888';
    const pts = points.filter(p => player.color in p.pwin);
    if (pts.length < 2) return null;
    const d = pts.map((p, i) => {
      const x = fi2x(p.frameIndex, maxFi).toFixed(2);
      const y = pw2y(p.pwin[player.color] ?? 0).toFixed(2);
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join(' ');
    return { color: player.color, hex, d };
  }).filter((p): p is NonNullable<typeof p> => p !== null), [players, points, maxFi]);

  if (!gameState) return null;

  if (points.length < 2) {
    return (
      <div>
        <div style={{
          fontFamily: 'var(--ff-display)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--text-ghost)', paddingBottom: 6,
        }}>
          Win Probability
        </div>
        <div style={{
          fontSize: 11.5, color: 'var(--text-ghost)', fontWeight: 600,
          padding: '10px 0', textAlign: 'center',
        }}>
          No evaluation data in this recording
        </div>
      </div>
    );
  }

  // ── Y-axis guide lines ────────────────────────────────────────────────────
  const yGuides = [
    { pwin: 1.0, label: '100' },
    { pwin: 0.5, label: '50' },
    { pwin: 0.0, label: '0' },
  ];

  // ── Cursor: find nearest data point to current replay step ────────────────
  const cursorPt = points.reduce((best, pt) =>
    Math.abs(pt.frameIndex - replayStep) < Math.abs(best.frameIndex - replayStep) ? pt : best
  , points[0]);
  const cursorX = fi2x(cursorPt.frameIndex, maxFi);

  // ── Tooltip cursor (hover) ────────────────────────────────────────────────
  const activePt  = tooltip ?? { x: cursorX, frameIndex: cursorPt.frameIndex, pwin: cursorPt.pwin };
  const showHover = tooltip !== null;

  return (
    <div>
      <div style={{
        fontFamily: 'var(--ff-display)', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--text-ghost)', paddingBottom: 6,
      }}>
        Win Probability
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* ── Y guide lines & labels ── */}
        {yGuides.map(({ pwin, label }) => (
          <g key={label}>
            <line
              x1={PAD_L} y1={pw2y(pwin)} x2={PAD_L + CW} y2={pw2y(pwin)}
              stroke="rgba(255,255,255,0.07)" strokeWidth={0.6}
              strokeDasharray={pwin === 0.5 ? '3 2' : undefined}
            />
            <text
              x={PAD_L - 3} y={pw2y(pwin)} textAnchor="end" dominantBaseline="middle"
              fontSize={6.5} fill="rgba(255,255,255,0.22)" fontFamily="var(--ff-display)"
            >
              {label}
            </text>
          </g>
        ))}

        {/* ── X axis labels ── */}
        {xLabels.map(({ x, label }) => (
          <text key={label}
            x={x} y={PAD_T + CH + PAD_B - 2}
            textAnchor="middle" fontSize={6.5}
            fill="rgba(255,255,255,0.2)" fontFamily="var(--ff-display)"
          >
            {label}
          </text>
        ))}

        {/* ── Hover/active area fill under leading player ── */}
        {/* ── Player win probability lines ── */}
        {paths.map(p => (
          <path
            key={p.color}
            d={p.d}
            fill="none"
            stroke={p.hex}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.82}
          />
        ))}

        {/* ── Hover cursor (lighter, shows where you'll jump) ── */}
        {showHover && (
          <line
            x1={activePt.x} y1={PAD_T}
            x2={activePt.x} y2={PAD_T + CH}
            stroke="rgba(255,255,255,0.18)" strokeWidth={1}
          />
        )}

        {/* ── Current step cursor ── */}
        <line
          x1={cursorX} y1={PAD_T}
          x2={cursorX} y2={PAD_T + CH}
          stroke="rgba(255,255,255,0.55)" strokeWidth={1}
          strokeDasharray="3 2"
        />

        {/* ── Dots on each line at the active cursor ── */}
        {paths.map(p => {
          const pw = activePt.pwin[p.color] ?? null;
          if (pw === null) return null;
          return (
            <circle
              key={p.color}
              cx={activePt.x}
              cy={pw2y(pw)}
              r={showHover ? 2.5 : 3}
              fill={p.hex}
              stroke="var(--bg-0, #060b15)"
              strokeWidth={1.5}
            />
          );
        })}

        {/* ── Tooltip box on hover ── */}
        {showHover && (() => {
          const boxW = 58;
          const boxH = 6 + players.length * 11;
          // Flip to left side if near right edge
          const rawX = activePt.x + 6;
          const boxX = rawX + boxW > VW - PAD_R ? activePt.x - boxW - 6 : rawX;
          const boxY = PAD_T;
          return (
            <g pointerEvents="none">
              <rect
                x={boxX} y={boxY} width={boxW} height={boxH}
                rx={4} fill="rgba(6,11,21,0.88)"
                stroke="rgba(125,165,225,0.2)" strokeWidth={0.6}
              />
              {players.map((player, i) => {
                const hex = PLAYER_COLORS[player.color as PlayerColor] || '#888';
                const pw  = activePt.pwin[player.color];
                if (pw === undefined) return null;
                return (
                  <g key={player.color} transform={`translate(${boxX + 6}, ${boxY + 6 + i * 11})`}>
                    <circle cx={3} cy={3} r={2.5} fill={hex} />
                    <text x={9} y={5} fontSize={7} fill={hex} fontFamily="var(--ff-display)" fontWeight="700">
                      {player.name.slice(0, 8)}
                    </text>
                    <text x={boxW - 10} y={5} fontSize={7} fill="rgba(255,255,255,0.7)"
                      fontFamily="var(--ff-display)" fontWeight="700" textAnchor="end">
                      {Math.round(pw * 100)}%
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
