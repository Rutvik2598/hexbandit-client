/* eslint-disable react-hooks/static-components */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import { useAuthStore } from '@/store/authStore';

// ---- Provider icons --------------------------------------------------------

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ---- Shared input style ----------------------------------------------------

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--glass-brd)',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'var(--ff-ui)',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

// ---- Mock user (demo only) -------------------------------------------------

const MOCK_NAMES = [
  'HexBaron', 'IronSettler', 'StoneMaster', 'RoadWarden', 'OreKnight',
  'BrickLord', 'DiceReaper', 'WheatstonePact', 'RobberKing', 'PortMaster',
  'GrainLancer', 'SheepHaven', 'HarborWolf', 'VictoryPoint', 'ColonistX',
];

const MOCK_USER_BASE = {
  username: 'hex_settler',
  level: 7,
  elo: 1423,
  rank: 'Gold II',
};

// ---- AuthModal -------------------------------------------------------------

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const login = useAuthStore(s => s.login);
  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const isLoading = loading !== null;

  const mockLogin = (provider: 'google' | 'email', name: string, mail: string) => {
    setLoading(provider);
    setTimeout(() => {
      login({ ...MOCK_USER_BASE, name, email: mail, provider });
      setLoading(null);
      onClose();
    }, 1300);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    const name = view === 'signup' ? (displayName || email.split('@')[0]) : email.split('@')[0];
    mockLogin('email', name, email);
  };

  const OAuthBtn = ({
    provider, label, icon, bg, border,
  }: {
    provider: 'google';
    label: string;
    icon: React.ReactNode;
    bg: string;
    border: string;
  }) => (
    <button
      type="button"
      onClick={() => {
        if (isLoading) return;
        const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
        mockLogin(provider, name, `${name.toLowerCase()}@gmail.com`);
      }}
      disabled={isLoading}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '11px 20px', borderRadius: 11,
        background: loading === provider ? 'rgba(255,255,255,0.10)' : bg,
        border: `1px solid ${loading === provider ? 'rgba(255,255,255,0.22)' : border}`,
        color: 'var(--text)', fontFamily: 'var(--ff-ui)', fontWeight: 700, fontSize: 14,
        cursor: isLoading ? 'default' : 'pointer',
        width: '100%', transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => !isLoading && ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)')}
      onMouseLeave={e => !isLoading && ((e.currentTarget as HTMLElement).style.background = bg)}
    >
      {loading === provider
        ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.25)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        : icon}
      {label}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={!isLoading ? onClose : undefined}
      />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="panel"
        style={{ position: 'relative', zIndex: 1, width: 420, maxWidth: '94vw', padding: '32px 28px 26px' }}
      >
        {/* Close */}
        {!isLoading && (
          <button onClick={onClose} className="btn" style={{ position: 'absolute', top: 16, right: 16, width: 34, height: 34, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
            <Icon name="close" size={15} color="var(--text-dim)" />
          </button>
        )}

        {/* Crest */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
          <svg width="44" height="50" viewBox="0 0 78 86" style={{ marginBottom: 12, filter: 'drop-shadow(0 6px 18px rgba(47,116,240,0.5))' }}>
            <defs>
              <linearGradient id="authCrestG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1f3f70" />
                <stop offset="1" stopColor="#0d2244" />
              </linearGradient>
            </defs>
            <path d="M39 2L73 21V64L39 84L5 64V21Z" fill="url(#authCrestG)" stroke="var(--amber)" strokeWidth="2.5" />
          </svg>
          <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 20, letterSpacing: '0.06em', marginBottom: 5 }}>
            HEXBANDIT
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-dim)', fontWeight: 500 }}>
            {view === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </div>
        </div>

        {/* Sign In / Sign Up toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, marginBottom: 22, border: '1px solid var(--hairline)' }}>
          {(['signin', 'signup'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => !isLoading && setView(v)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                fontFamily: 'var(--ff-ui)', fontWeight: 700, fontSize: 13.5,
                cursor: isLoading ? 'default' : 'pointer',
                background: view === v ? 'rgba(47,116,240,0.22)' : 'transparent',
                color: view === v ? 'var(--text)' : 'var(--text-faint)',
                transition: 'all 0.15s',
                boxShadow: view === v ? '0 1px 0 rgba(255,255,255,0.07) inset' : 'none',
              }}
            >
              {v === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* OAuth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <OAuthBtn
            provider="google"
            label="Continue with Google"
            icon={<GoogleG />}
            bg="rgba(255,255,255,0.07)"
            border="rgba(255,255,255,0.13)"
          />
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-ghost)', fontWeight: 600, letterSpacing: '0.06em' }}>or with email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {/* Name field — sign up only */}
          <AnimatePresence initial={false}>
            {view === 'signup' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 46 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  disabled={isLoading}
                  style={inputStyle}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isLoading}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--glass-brd2)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--glass-brd)')}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={isLoading}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--glass-brd2)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--glass-brd)')}
          />

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '13px 0', marginTop: 3, fontSize: 15,
              fontFamily: 'var(--ff-display)', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading === 'email'
              ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.25)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : view === 'signin' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500, lineHeight: 1.5 }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </div>
      </motion.div>
    </div>
  );
}
