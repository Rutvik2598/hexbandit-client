import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import type { IconName } from '@/shared/components/Icon';

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

function ProfileChip({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 14px 8px 8px', borderRadius: 999,
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: '50%',
        display: 'grid', placeItems: 'center', flexShrink: 0,
        background: 'linear-gradient(150deg,#2f74f0,#1c4fb0)',
        border: '1px solid rgba(255,255,255,0.25)',
        boxShadow: '0 2px 8px -2px var(--sapphire-glow)',
      }}>
        <Icon name="user" size={19} color="#fff" />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15, paddingRight: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>You</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
          Settler · Lv 7
        </span>
      </span>
    </button>
  );
}

// ---- Feature card (large — Play vs Humans / Play vs Bots) ------------------

interface FeatureCardProps {
  icon: IconName;
  kicker: string;
  title: string;
  desc: string;
  accent: string;
  enabled: boolean;
  onClick: () => void;
}

function FeatureCard({ icon, kicker, title, desc, accent, enabled, onClick }: FeatureCardProps) {
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
          ? `linear-gradient(165deg, color-mix(in srgb, ${accent} 24%, var(--glass-2)), var(--glass-2))`
          : `linear-gradient(165deg, color-mix(in srgb, ${accent} 14%, var(--glass-2)), var(--glass-2))`,
        border: `1px solid ${hover ? accent : 'var(--glass-brd)'}`,
        boxShadow: hover
          ? `0 20px 44px -16px ${accent}, inset 0 1px 0 rgba(255,255,255,0.08)`
          : 'var(--sh-panel)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* faint hex motif */}
      <div style={{
        position: 'absolute', right: -30, top: -30, width: 160, height: 160,
        opacity: hover ? 0.16 : 0.08, transition: 'opacity 0.2s',
        background: accent,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      }} />

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
        position: 'relative', width: 56, height: 56, borderRadius: 15,
        display: 'grid', placeItems: 'center', marginBottom: 18,
        background: `color-mix(in srgb, ${accent} 26%, transparent)`,
        border: `1px solid ${accent}`,
      }}>
        <Icon name={icon} size={28} color={accent} strokeWidth={1.9} />
      </div>

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
        lineHeight: 1.5, maxWidth: isMobile ? 'none' : 260,
      }}>
        {desc}
      </div>

      <div style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
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
    </motion.button>
  );
}

// ---- Menu tile (small — Tournaments / Practice / Profile) ------------------

interface MenuTileProps {
  icon: IconName;
  title: string;
  desc: string;
  accent: string;
  enabled: boolean;
  onClick: () => void;
}

function MenuTile({ icon, title, desc, accent, enabled, onClick }: MenuTileProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2, background: 'var(--bg-3)' as string }}
      transition={{ duration: 0.16 }}
      style={{
        position: 'relative', textAlign: 'left', flex: 1, minWidth: 0,
        padding: '18px', borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 15,
        background: 'rgba(255,255,255,0.028)',
        border: '1px solid var(--hairline)',
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
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
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
    </motion.button>
  );
}

// ---- Toast -----------------------------------------------------------------

function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            zIndex: 200,
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function soon(label: string) {
    setToast(`${label} isn't available in this build yet`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto' }}>
      <div className="atmos" />

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
          {!isMobile && <ProfileChip onClick={() => soon('Profile')} />}
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
            accent="var(--sapphire-bright)"
            enabled={false}
            onClick={() => soon('Play vs Humans')}
          />
          <FeatureCard
            icon="robot"
            kicker="Single player"
            title="Play vs Bots"
            desc="Set up a quick match against our AI agents — Easy, Hard or Strongest."
            accent="var(--amber)"
            enabled={true}
            onClick={() => navigate('/lobby')}
          />
        </div>

        {/* secondary tiles */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 14 }}>
          <MenuTile
            icon="trophy"
            title="Tournaments"
            desc="Bracketed events & seasons"
            accent="#e8b53f"
            enabled={false}
            onClick={() => soon('Tournaments')}
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
            desc="Stats, rank & history"
            accent="var(--p-red)"
            enabled={false}
            onClick={() => soon('Profile')}
          />
        </div>

        <div style={{
          textAlign: 'center', marginTop: 30,
          fontSize: 12, color: 'var(--text-ghost)',
          fontWeight: 600, letterSpacing: '0.04em',
        }}>
          Hexbandit · v0.4 · staging-api.hexbandit.io
        </div>
      </motion.div>

      <Toast msg={toast} />
    </div>
  );
}
