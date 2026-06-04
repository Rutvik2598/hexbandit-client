import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import { HexGridBackground } from '@/shared/components/HexGridBackground';
import { VideoBackground } from '@/shared/components/VideoBackground';
import { AuthModal } from './AuthModal';
import { ProfileModal } from './ProfileModal';
import { useAuthStore } from '@/store/authStore';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import type { IconName } from '@/shared/components/Icon';

// ---- Mocked data -----------------------------------------------------------

const TICKER_STATS: Array<{ icon: IconName; label: string; value: string }> = [
  { icon: 'dice',       label: 'Games played',       value: '12,847'           },
  { icon: 'play',       label: 'Active now',          value: '84 games'         },
  { icon: 'trophy',     label: 'Top agent',           value: 'ArchExpert-RL'    },
  { icon: 'star',       label: 'Top win rate',        value: '67%'              },
  { icon: 'target',     label: 'Avg game length',     value: '31 turns'         },
  { icon: 'road-badge', label: 'Longest road record', value: '15 segments'      },
  { icon: 'users',      label: 'Settlers registered', value: '3,291'            },
  { icon: 'army-badge', label: 'Largest army record', value: '12 knights'       },
];

const PLAYER_COLORS_ACTIVITY: Record<string, string> = {
  Red: '#ef4444', Blue: '#3b82f6', Orange: '#f97316', White: '#cbd5e1',
};

const MOCK_ACTIVITY = [
  { player: 'Red',    action: 'won',                    detail: '10 VP · 68 turns',  ago: '1m'  },
  { player: 'Blue',   action: 'won via largest army',   detail: '45 turns',          ago: '3m'  },
  { player: 'Orange', action: 'won',                    detail: '10 VP · 89 turns',  ago: '7m'  },
  { player: 'Red',    action: 'won · longest road',     detail: '52 turns',          ago: '11m' },
  { player: 'White',  action: 'won',                    detail: '10 VP · 77 turns',  ago: '14m' },
  { player: 'Blue',   action: 'won',                    detail: '10 VP · 63 turns',  ago: '18m' },
  { player: 'Orange', action: 'won via knight domination', detail: '41 turns',       ago: '22m' },
  { player: 'Red',    action: 'won',                    detail: '10 VP · 95 turns',  ago: '26m' },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'ArchExpert-RL',    elo: 1847, winRate: 67, games: 4821 },
  { rank: 2, name: 'HexMaster-Pro',    elo: 1782, winRate: 61, games: 3204 },
  { rank: 3, name: 'Colonist-v3',      elo: 1734, winRate: 58, games: 2891 },
  { rank: 4, name: 'RoboSettler',      elo: 1698, winRate: 54, games: 1992 },
  { rank: 5, name: 'BrickLayer-9',     elo: 1654, winRate: 51, games: 1547 },
  { rank: 6, name: 'WheatstoneBridge', elo: 1612, winRate: 48, games: 1203 },
  { rank: 7, name: 'OreChaser-X',      elo: 1588, winRate: 46, games:  987 },
  { rank: 8, name: 'SheepHerder',      elo: 1562, winRate: 44, games:  834 },
];

const MOCK_ROOMS: Array<{
  id: string;
  players: string[];
  turn: number;
  status: 'live' | 'waiting';
  ago: string | null;
}> = [
  { id: 'A1B2', players: ['Human', 'ArchExpert-RL', 'HexMaster-Pro', 'Colonist-v3'], turn: 23, status: 'live',    ago: '4m'  },
  { id: 'C3D4', players: ['BrickLayer-9', 'RoboSettler', 'OreChaser-X'],             turn:  8, status: 'live',    ago: '12m' },
  { id: 'E5F6', players: ['Human', 'ArchExpert-RL', 'WheatstoneBridge', 'SheepHerder'], turn: 0, status: 'waiting', ago: null  },
  { id: 'G7H8', players: ['Colonist-v3', 'RoboSettler'],                             turn: 47, status: 'live',    ago: '31m' },
  { id: 'I9J0', players: ['ArchExpert-RL', 'BrickLayer-9', 'OreChaser-X', 'HexMaster-Pro'], turn: 12, status: 'live', ago: '18m' },
];

// ---- Mini board hex data ---------------------------------------------------

const SQRT3 = Math.sqrt(3);
const R_HEX = 13;

const TILE_COLORS: Record<string, string> = {
  wood:   '#2d5a1e',
  brick:  '#7a3018',
  sheep:  '#4f8020',
  wheat:  '#a87010',
  ore:    '#405060',
  desert: '#7a6840',
};

// 19 hexes in axial coords — standard Catan board (|q|≤2, |r|≤2, |q+r|≤2)
const HEX_TILES: Array<{ q: number; r: number; res: string }> = [
  { q: -2, r:  0, res: 'ore'    },
  { q: -2, r:  1, res: 'wheat'  },
  { q: -2, r:  2, res: 'wood'   },
  { q: -1, r: -1, res: 'sheep'  },
  { q: -1, r:  0, res: 'wood'   },
  { q: -1, r:  1, res: 'brick'  },
  { q: -1, r:  2, res: 'wheat'  },
  { q:  0, r: -2, res: 'wood'   },
  { q:  0, r: -1, res: 'sheep'  },
  { q:  0, r:  0, res: 'desert' },
  { q:  0, r:  1, res: 'wheat'  },
  { q:  0, r:  2, res: 'ore'    },
  { q:  1, r: -2, res: 'brick'  },
  { q:  1, r: -1, res: 'sheep'  },
  { q:  1, r:  0, res: 'wood'   },
  { q:  1, r:  1, res: 'wheat'  },
  { q:  2, r: -2, res: 'ore'    },
  { q:  2, r: -1, res: 'brick'  },
  { q:  2, r:  0, res: 'sheep'  },
];

function hexPolygonPoints(q: number, r: number, rad: number): string {
  const cx = rad * SQRT3 * (q + r / 2);
  const cy = rad * 1.5 * r;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + (rad - 1) * Math.cos(a)).toFixed(1)},${(cy + (rad - 1) * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

const BOARD_VB_PAD = 8;
const BOARD_EXTENT = R_HEX * SQRT3 * 2.5 + BOARD_VB_PAD;
const BOARD_SVG_W = 128;
const BOARD_SVG_H = 120;

function MiniBoardPreview({ visible }: { visible: boolean }) {
  const [glowIdx, setGlowIdx] = useState(4);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setGlowIdx(Math.floor(Math.random() * 19));
    }, 1800);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <div style={{
      position: 'absolute', right: -8, top: 0, bottom: 0,
      display: 'flex', alignItems: 'center',
      pointerEvents: 'none', zIndex: 0,
    }}>
      <motion.div
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ position: 'relative' }}
      >
        {/* Blend the board into the card on the left */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 72, zIndex: 1,
          background: 'linear-gradient(to right, rgba(20,35,58,0.96) 0%, rgba(20,35,58,0.5) 60%, transparent 100%)',
        }} />
        <svg
          width={BOARD_SVG_W} height={BOARD_SVG_H}
          viewBox={`-${BOARD_EXTENT} -${BOARD_EXTENT * 0.95} ${BOARD_EXTENT * 2} ${BOARD_EXTENT * 1.9}`}
        >
          {HEX_TILES.map(({ q, r, res }, idx) => (
            <g key={idx}>
              <polygon
                points={hexPolygonPoints(q, r, R_HEX)}
                fill={TILE_COLORS[res]}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="0.7"
              />
              {idx === glowIdx && (
                <polygon
                  points={hexPolygonPoints(q, r, R_HEX)}
                  fill="rgba(255,240,180,0.18)"
                  stroke="rgba(255,220,80,0.65)"
                  strokeWidth="1.1"
                >
                  <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite" />
                </polygon>
              )}
            </g>
          ))}
        </svg>
      </motion.div>
    </div>
  );
}

// ---- Stats ticker bar ------------------------------------------------------

function StatsTickerBar() {
  const doubled = [...TICKER_STATS, ...TICKER_STATS];
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      height: 36,
      background: 'rgba(6,11,21,0.92)',
      borderTop: '1px solid rgba(125,165,225,0.10)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center',
    }}>
      <div style={{ animation: 'tickerScroll 44s linear infinite', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
        {doubled.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 28, paddingRight: 4 }}>
            <Icon name={item.icon} size={11} color="var(--amber)" />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)' }}>{item.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-dim)' }}>{item.value}</span>
            <span style={{ color: 'var(--hairline)', paddingLeft: 20, fontSize: 13 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Recent activity feed --------------------------------------------------

function RecentActivityFeed() {
  const doubled = [...MOCK_ACTIVITY, ...MOCK_ACTIVITY];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="eyebrow">Recent games</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#4ade80', boxShadow: '0 0 6px #4ade80',
            animation: 'thinking-pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#4ade80', letterSpacing: '0.08em' }}>LIVE</span>
        </span>
      </div>

      <div style={{ height: 172, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 32, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(6,11,21,0.9) 0%, transparent 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(6,11,21,0.9) 0%, transparent 100%)',
        }} />

        <div style={{ animation: 'activityScroll 26s linear infinite' }}>
          {doubled.map((item, i) => {
            const color = PLAYER_COLORS_ACTIVITY[item.player] || '#ccc';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', marginBottom: 5,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.022)',
                border: '1px solid var(--hairline)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color }} />
                <span style={{ fontSize: 13, fontWeight: 800, color, flexShrink: 0 }}>{item.player}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.action}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {item.detail}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-ghost)', fontWeight: 600, flexShrink: 0 }}>
                  {item.ago} ago
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Leaderboard modal -----------------------------------------------------

function LeaderboardModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="panel"
        style={{ position: 'relative', zIndex: 1, width: 560, maxWidth: '94vw', maxHeight: '82vh', overflowY: 'auto', padding: '26px 26px 22px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Global rankings · mocked</div>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 22, letterSpacing: '0.04em' }}>
              Leaderboard
            </div>
          </div>
          <button onClick={onClose} className="btn" style={{ width: 36, height: 36, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="close" size={16} color="var(--text-dim)" />
          </button>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 72px 72px 72px',
          gap: 8, padding: '0 12px', marginBottom: 8,
        }}>
          {['#', 'Agent', 'ELO', 'Win %', 'Games'].map((h, i) => (
            <span key={h} className="eyebrow" style={{ textAlign: i > 1 ? 'right' : undefined }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {MOCK_LEADERBOARD.map((e, i) => (
            <motion.div
              key={e.rank}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 72px 72px 72px',
                gap: 8, padding: '11px 12px', borderRadius: 10, alignItems: 'center',
                background: e.rank === 1 ? 'rgba(240,169,58,0.10)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${e.rank === 1 ? 'rgba(240,169,58,0.25)' : 'var(--hairline)'}`,
              }}
            >
              <span style={{
                fontWeight: 800, fontSize: 13,
                color: e.rank === 1 ? 'var(--amber)' : e.rank <= 3 ? 'var(--text-dim)' : 'var(--text-ghost)',
              }}>{e.rank}</span>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--sapphire-bright)', textAlign: 'right' }}>{e.elo}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dim)', textAlign: 'right' }}>{e.winRate}%</span>
              <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>{e.games.toLocaleString()}</span>
            </motion.div>
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text-ghost)', fontWeight: 600, letterSpacing: '0.04em', textAlign: 'center' }}>
          Rankings update every hour · 4-player games only
        </div>
      </motion.div>
    </div>
  );
}

// ---- Rooms modal -----------------------------------------------------------

function RoomsModal({ onClose }: { onClose: () => void }) {
  const liveCount = MOCK_ROOMS.filter(r => r.status === 'live').length;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="panel"
        style={{ position: 'relative', zIndex: 1, width: 580, maxWidth: '94vw', maxHeight: '82vh', overflowY: 'auto', padding: '26px 26px 22px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="eyebrow">Active rooms · mocked</span>
              <span style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
                color: '#4ade80', background: 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.3)',
                padding: '2px 7px', borderRadius: 6,
              }}>
                {liveCount} LIVE
              </span>
            </div>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 22, letterSpacing: '0.04em' }}>
              Game Rooms
            </div>
          </div>
          <button onClick={onClose} className="btn" style={{ width: 36, height: 36, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="close" size={16} color="var(--text-dim)" />
          </button>
        </div>

        {/* Room cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MOCK_ROOMS.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid var(--hairline)',
              }}
            >
              {/* Room ID */}
              <div style={{
                fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14,
                color: 'var(--text-dim)', letterSpacing: '0.06em',
                width: 44, flexShrink: 0,
              }}>{room.id}</div>

              {/* Players */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {room.players.map((p, pi) => (
                    <span key={pi} style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: p === 'Human' ? 'rgba(228,75,67,0.15)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${p === 'Human' ? 'rgba(228,75,67,0.3)' : 'var(--hairline)'}`,
                      color: p === 'Human' ? 'var(--p-red)' : 'var(--text-dim)',
                    }}>{p}</span>
                  ))}
                </div>
              </div>

              {/* Turn */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                {room.status === 'live' ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)' }}>
                    Turn {room.turn}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-soft)', opacity: 0.7 }}>
                    Waiting
                  </span>
                )}
              </div>

              {/* Time */}
              {room.ago && (
                <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 600, flexShrink: 0 }}>
                  {room.ago} ago
                </div>
              )}

              {/* Status badge */}
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
                padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                background: room.status === 'live' ? 'rgba(74,222,128,0.1)' : 'rgba(240,169,58,0.1)',
                border: `1px solid ${room.status === 'live' ? 'rgba(74,222,128,0.3)' : 'rgba(240,169,58,0.3)'}`,
                color: room.status === 'live' ? '#4ade80' : 'var(--amber-soft)',
              }}>
                {room.status === 'live' ? 'LIVE' : 'OPEN'}
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text-ghost)', fontWeight: 600, letterSpacing: '0.04em', textAlign: 'center' }}>
          Spectate and join coming soon
        </div>
      </motion.div>
    </div>
  );
}

// ---- Logo ------------------------------------------------------------------

function HomeLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ position: 'relative', width: 42, height: 47 }}>
        <svg width="42" height="47" viewBox="0 0 78 86"
          style={{ filter: 'drop-shadow(0 6px 14px rgba(47,116,240,0.45))' }}>
          <defs>
            <linearGradient id="homeCrest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f3f70" />
              <stop offset="1" stopColor="#0d2244" />
            </linearGradient>
          </defs>
          <path d="M39 2L73 21V64L39 84L5 64V21Z"
            fill="url(#homeCrest)" stroke="var(--amber)" strokeWidth="2.5" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <svg width="19" height="19" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb" />
            <circle cx="8"  cy="8"  r="1.6" fill="#0e2244" />
            <circle cx="16" cy="16" r="1.6" fill="#0e2244" />
            <circle cx="12" cy="12" r="1.6" fill="var(--p-red)" />
          </svg>
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--ff-display)', fontWeight: 700,
        fontSize: 24, letterSpacing: '0.06em',
      }}>
        HEXBANDIT
      </span>
    </div>
  );
}

// ---- Profile chip ----------------------------------------------------------

function ProfileChip({ onSignIn, onProfile }: { onSignIn: () => void; onProfile: () => void }) {
  const user = useAuthStore(s => s.user);

  if (!user) {
    return (
      <button onClick={onSignIn} className="btn btn-primary" style={{
        padding: '9px 18px', fontSize: 13.5, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <Icon name="user" size={15} color="#fff" />
        Sign In
      </button>
    );
  }

  return (
    <button onClick={onProfile} className="btn" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 14px 7px 7px', borderRadius: 999,
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: '50%',
        display: 'grid', placeItems: 'center', flexShrink: 0,
        background: 'linear-gradient(145deg, #d4a820, #7a5e10)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 2px 8px -2px rgba(212,168,32,0.45)',
        fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14, color: '#fff',
      }}>
        {user.name.charAt(0).toUpperCase()}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15, paddingRight: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{user.name.split(' ')[0]}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
          {user.rank} · Lv {user.level}
        </span>
      </span>
    </button>
  );
}

// ---- Feature card ----------------------------------------------------------

interface FeatureCardProps {
  icon: IconName;
  kicker: string;
  title: string;
  desc: string;
  accent: string;
  enabled: boolean;
  boardPreview?: boolean;
  onClick: () => void;
}

function FeatureCard({ icon, kicker, title, desc, accent, enabled, boardPreview, onClick }: FeatureCardProps) {
  const [hover, setHover] = useState(false);
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'relative', textAlign: 'left', flex: 1, minWidth: 0,
        padding: isMobile ? '20px 20px 18px' : '26px 26px 24px', borderRadius: 20, overflow: 'hidden',
        background: hover
          ? `linear-gradient(165deg, color-mix(in srgb, ${accent} 24%, rgba(12,22,40,0.92)), rgba(12,22,40,0.92))`
          : `linear-gradient(165deg, color-mix(in srgb, ${accent} 14%, rgba(12,22,40,0.90)), rgba(12,22,40,0.90))`,
        border: `1px solid ${hover ? accent : 'var(--glass-brd)'}`,
        boxShadow: hover
          ? `0 20px 44px -16px ${accent}, inset 0 1px 0 rgba(255,255,255,0.08)`
          : 'var(--sh-panel)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Faint hex motif (hidden when board preview is showing) */}
      {!boardPreview && (
        <div style={{
          position: 'absolute', right: -30, top: -30, width: 160, height: 160,
          opacity: hover ? 0.16 : 0.08, transition: 'opacity 0.2s',
          background: accent,
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }} />
      )}

      {/* Mini board preview */}
      {boardPreview && <MiniBoardPreview visible={hover} />}

      {!enabled && (
        <span style={{
          position: 'absolute', top: 18, right: 18,
          fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
          color: 'var(--text-faint)', padding: '4px 9px', borderRadius: 6,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hairline)',
        }}>
          SOON
        </span>
      )}

      {/* icon box */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 56, height: 56, borderRadius: 15,
        display: 'grid', placeItems: 'center', marginBottom: 18,
        background: `color-mix(in srgb, ${accent} 26%, transparent)`,
        border: `1px solid ${accent}`,
      }}>
        <Icon name={icon} size={28} color={accent} strokeWidth={1.9} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: accent, marginBottom: 7,
        }}>
          {kicker}
        </div>
        <div style={{
          fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isMobile ? 22 : 26,
          color: 'var(--text)', letterSpacing: '0.01em', marginBottom: 8,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: 'var(--text-dim)',
          lineHeight: 1.5, maxWidth: isMobile ? 'none' : 220,
        }}>
          {desc}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 20, fontSize: 13, fontWeight: 800,
          color: enabled ? accent : 'var(--text-faint)',
        }}>
          {enabled ? 'Play now' : 'Coming soon'}
          {enabled && (
            <motion.span
              animate={{ x: hover ? 4 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex' }}
            >
              <Icon name="arrow-right" size={16} color={accent} />
            </motion.span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ---- Menu tile -------------------------------------------------------------

interface MenuTileProps {
  icon: IconName;
  title: string;
  desc: string;
  accent: string;
  enabled: boolean;
  badge?: string;
  onClick: () => void;
}

function MenuTile({ icon, title, desc, accent, enabled, badge, onClick }: MenuTileProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2, background: 'rgba(20,35,58,0.95)' as string }}
      transition={{ duration: 0.16 }}
      style={{
        position: 'relative', textAlign: 'left', flex: 1, minWidth: 0,
        padding: '18px', borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 15,
        background: 'rgba(10,19,36,0.82)',
        border: '1px solid rgba(125,165,225,0.18)',
        cursor: 'pointer',
        transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-brd2)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline)'; }}
    >
      <span style={{
        width: 44, height: 44, borderRadius: 12,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        background: `color-mix(in srgb, ${accent} 18%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`,
      }}>
        <Icon name={icon} size={22} color={accent} strokeWidth={1.8} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)' }}>{title}</span>
          {!enabled && (
            <span style={{
              fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em',
              color: 'var(--text-faint)', padding: '2px 6px', borderRadius: 5,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hairline)',
            }}>
              SOON
            </span>
          )}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text-faint)',
          lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {desc}
        </span>
      </span>
      {badge && (
        <span style={{
          fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
          padding: '3px 8px', borderRadius: 6, flexShrink: 0,
          background: 'rgba(74,222,128,0.1)',
          border: '1px solid rgba(74,222,128,0.3)',
          color: '#4ade80',
        }}>
          {badge}
        </span>
      )}
    </motion.button>
  );
}

// ---- Toast -----------------------------------------------------------------

function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: 16, scale: 0.96, x: '-50%' }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', bottom: 54, left: '50%',
            zIndex: 300,
            background: 'var(--glass-2)', border: '1px solid var(--glass-brd2)',
            borderRadius: 12, padding: '12px 20px',
            fontSize: 13.5, fontWeight: 700, color: 'var(--text)',
            boxShadow: 'var(--sh-pop)', backdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', gap: 9,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon name="gear" size={16} color="var(--amber)" />
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---- HomePage --------------------------------------------------------------

export default function HomePage() {
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const user = useAuthStore(s => s.user);
  const [toast, setToast] = useState<string | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function soon(label: string) {
    setToast(`${label} isn't available in this build yet`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const liveRooms = MOCK_ROOMS.filter(r => r.status === 'live').length;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto', paddingBottom: 36 }}>
      <div className="atmos" />
      <VideoBackground />
      <HexGridBackground />

      {/* top blue glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(680px 460px at 50% 8%, rgba(47,116,240,0.18), transparent 70%)',
      }} />

      {/* top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '14px 16px' : '22px 32px',
      }}>
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="28" height="32" viewBox="0 0 78 86" style={{ filter: 'drop-shadow(0 4px 10px rgba(47,116,240,0.4))' }}>
              <defs>
                <linearGradient id="homeCrestSm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1f3f70" /><stop offset="1" stopColor="#0d2244" />
                </linearGradient>
              </defs>
              <path d="M39 2L73 21V64L39 84L5 64V21Z" fill="url(#homeCrestSm)" stroke="var(--amber)" strokeWidth="2.5" />
              <circle cx="39" cy="43" r="10" fill="#eef3fb" />
              <circle cx="34" cy="40" r="2" fill="var(--p-red)" />
            </svg>
            <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 18, letterSpacing: '0.06em' }}>
              HEXBANDIT
            </span>
          </div>
        ) : (
          <HomeLogo />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => soon('Settings')}
            className="btn"
            style={{ width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}
          >
            <Icon name="gear" size={isMobile ? 17 : 19} color="var(--text-dim)" />
          </button>
          {isMobile && !user && (
            <button onClick={() => setAuthOpen(true)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700 }}>
              Sign In
            </button>
          )}
          {!isMobile && <ProfileChip onSignIn={() => setAuthOpen(true)} onProfile={() => setProfileOpen(true)} />}
        </div>
      </div>

      {/* main content */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 3,
          width: isMobile ? '100%' : 880, maxWidth: isMobile ? '100%' : '94vw',
          padding: isMobile ? '72px 16px 32px' : '96px 0 40px',
        }}
      >
        {/* welcome header */}
        <div style={{ marginBottom: 26 }}>
          <div className="eyebrow" style={{ color: 'var(--amber-soft)', letterSpacing: '0.3em', marginBottom: 10 }}>
            Welcome back, Settler
          </div>
          <h1 style={{
            fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isMobile ? 28 : 40,
            margin: 0, letterSpacing: '0.01em',
            background: 'linear-gradient(180deg,#fff,#c4d4ee)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            Choose your table
          </h1>
        </div>

        {/* primary feature cards */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 18, marginBottom: 18 }}>
          <FeatureCard
            icon="users"
            kicker="Multiplayer"
            title="Play vs Humans"
            desc="Matchmake against real settlers worldwide in ranked or casual rooms."
            accent="#4f8dff"
            enabled={false}
            onClick={() => soon('Play vs Humans')}
          />
          <FeatureCard
            icon="robot"
            kicker="Single player"
            title="Play vs Bots"
            desc="Set up a quick match against our AI agents — Easy, Hard or Strongest."
            accent="#f0a93a"
            enabled={true}
            boardPreview
            onClick={() => navigate('/lobby')}
          />
        </div>

        {/* secondary tiles */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 14, marginBottom: 26 }}>
          <MenuTile
            icon="star"
            title="Rooms"
            desc="Browse & spectate live games"
            accent="#4ade80"
            enabled={true}
            badge={`${liveRooms} live`}
            onClick={() => setRoomsOpen(true)}
          />
          <MenuTile
            icon="trophy"
            title="Leaderboard"
            desc="Global agent rankings"
            accent="#e8b53f"
            enabled={true}
            onClick={() => setLeaderboardOpen(true)}
          />
          <MenuTile
            icon="target"
            title="Practice"
            desc="Drills & scenario boards"
            accent="#93c95f"
            enabled={false}
            onClick={() => soon('Practice')}
          />
          <MenuTile
            icon="user"
            title="Profile"
            desc={user ? `${user.rank} · ELO ${user.elo}` : 'Sign in to view profile'}
            accent="#e44b43"
            enabled={true}
            onClick={() => user ? setProfileOpen(true) : setAuthOpen(true)}
          />
        </div>

        {/* Recent activity feed */}
        <RecentActivityFeed />

        <div style={{
          textAlign: 'center', marginTop: 24,
          fontSize: 12, color: 'var(--text-ghost)',
          fontWeight: 600, letterSpacing: '0.04em',
        }}>
          Hexbandit · v0.4 · staging-api.hexbandit.io
        </div>
      </motion.div>

      {/* Stats ticker */}
      <StatsTickerBar />

      <Toast msg={toast} />

      {/* Modals */}
      <AnimatePresence>
        {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {roomsOpen && <RoomsModal onClose={() => setRoomsOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {profileOpen && user && <ProfileModal onClose={() => setProfileOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
