import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import { useAuthStore } from '@/store/authStore';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

// ---- Mock profile data (extends the auth user with game history) ------------

const MOCK_STATS = {
  gamesPlayed: 284,
  wins: 119,
  losses: 165,
  winRate: 42,
  avgTurns: 34,
  bestStreak: 7,
  eloChange: +23,
  favoriteColor: 'RED' as const,
};

const GAME_COLORS: Record<string, string> = {
  RED: '#ef4444', BLUE: '#3b82f6', ORANGE: '#f97316', WHITE: '#cbd5e1',
};

const MOCK_RECENT: Array<{ result: 'win' | 'loss'; color: string; vp: number; turns: number; ago: string }> = [
  { result: 'win',  color: 'RED',    vp: 10, turns: 68, ago: '2h'  },
  { result: 'loss', color: 'BLUE',   vp:  8, turns: 45, ago: '4h'  },
  { result: 'win',  color: 'RED',    vp: 10, turns: 89, ago: '6h'  },
  { result: 'win',  color: 'ORANGE', vp: 10, turns: 52, ago: '8h'  },
  { result: 'loss', color: 'WHITE',  vp:  7, turns: 77, ago: '1d'  },
  { result: 'win',  color: 'RED',    vp: 10, turns: 61, ago: '1d'  },
];

const ACHIEVEMENTS = [
  { label: 'Road Baron',     desc: 'Longest road in 10 games', accent: '#f97316' },
  { label: 'Knight Lord',    desc: 'Largest army in 5 games',  accent: '#3b82f6' },
  { label: 'Monopolist',     desc: 'Played Monopoly 20 times', accent: '#a855f7' },
  { label: 'Speed Settler',  desc: 'Won in under 30 turns',    accent: '#4ade80' },
];

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  email:  'Email',
};

// ---- ProfileModal ----------------------------------------------------------

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  if (!user) return null;

  const initial = user.name.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="panel"
        style={{ position: 'relative', zIndex: 1, width: 520, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', padding: '26px 24px 22px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="btn" style={{ position: 'absolute', top: 16, right: 16, width: 34, height: 34, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
          <Icon name="close" size={15} color="var(--text-dim)" />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
          {/* Avatar */}
          <div style={{
            width: 68, height: 68, flexShrink: 0,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: 'linear-gradient(145deg, #d4a820, #7a5e10)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 28px -8px rgba(212,168,32,0.6)',
          }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 26, color: '#fff' }}>
              {initial}
            </span>
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 22, color: 'var(--text)', letterSpacing: '0.02em', marginBottom: 3 }}>
              {user.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600, marginBottom: 8 }}>
              @{user.username} · via {PROVIDER_LABELS[user.provider]}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em',
                padding: '3px 10px', borderRadius: 6,
                background: 'rgba(240,169,58,0.14)', border: '1px solid rgba(240,169,58,0.3)',
                color: 'var(--amber-soft)',
              }}>
                {user.rank}
              </span>
              <span style={{
                fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em',
                padding: '3px 10px', borderRadius: 6,
                background: 'rgba(47,116,240,0.14)', border: '1px solid rgba(47,116,240,0.28)',
                color: 'var(--sapphire-bright)',
              }}>
                Lv {user.level}
              </span>
            </div>
          </div>

          {/* ELO */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 28, color: 'var(--text)', letterSpacing: '0.02em' }}>
              {user.elo.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: MOCK_STATS.eloChange >= 0 ? '#4ade80' : '#f87171', letterSpacing: '0.06em' }}>
              {MOCK_STATS.eloChange >= 0 ? '+' : ''}{MOCK_STATS.eloChange} this week
            </div>
            <div className="eyebrow" style={{ marginTop: 2 }}>ELO</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
          {[
            { label: 'Games',    value: MOCK_STATS.gamesPlayed },
            { label: 'Wins',     value: MOCK_STATS.wins        },
            { label: 'Win Rate', value: `${MOCK_STATS.winRate}%` },
            { label: 'Avg Turns',value: MOCK_STATS.avgTurns    },
          ].map(({ label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                padding: '12px 10px', borderRadius: 12, textAlign: 'center',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)',
              }}
            >
              <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 3 }}>
                {value}
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Win bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>{MOCK_STATS.wins}W</span>
          <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${MOCK_STATS.winRate}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
              style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #4ade8088, #4ade80)' }}
            />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#f87171', flexShrink: 0 }}>{MOCK_STATS.losses}L</span>
        </div>

        {/* Recent games */}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Recent games</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {MOCK_RECENT.map((g, i) => {
            const color = GAME_COLORS[g.color] || '#ccc';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  background: g.result === 'win' ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${g.result === 'win' ? 'rgba(74,222,128,0.15)' : 'var(--hairline)'}`,
                }}
              >
                {/* Result badge */}
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
                  padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                  background: g.result === 'win' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                  color: g.result === 'win' ? '#4ade80' : '#f87171',
                }}>
                  {g.result === 'win' ? 'WIN' : 'LOSS'}
                </span>

                {/* Color dot */}
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}` }} />

                {/* Color name */}
                <span style={{ fontSize: 12.5, fontWeight: 700, color, flexShrink: 0 }}>{g.color}</span>

                {/* VP */}
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-dim)', fontWeight: 600 }}>
                  {g.vp} VP
                </span>

                {/* Turns */}
                <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>
                  {g.turns} turns
                </span>

                {/* Time */}
                <span style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 600, flexShrink: 0 }}>
                  {g.ago} ago
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Achievements */}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Achievements</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 22 }}>
          {ACHIEVEMENTS.map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: `color-mix(in srgb, ${a.accent} 7%, rgba(15,27,47,0.4))`,
                border: `1px solid color-mix(in srgb, ${a.accent} 25%, var(--hairline))`,
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: a.accent, flexShrink: 0,
                boxShadow: `0 0 6px ${a.accent}`,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', marginBottom: 1 }}>{a.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 500, lineHeight: 1.4 }}>{a.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="btn"
          style={{
            width: '100%', padding: '12px 0', fontSize: 14,
            fontFamily: 'var(--ff-ui)', fontWeight: 700,
            color: '#f87171', borderColor: 'rgba(248,113,113,0.2)',
            background: 'rgba(248,113,113,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Icon name="close" size={15} color="#f87171" />
          Sign Out
        </button>
      </motion.div>
    </div>
  );
}
