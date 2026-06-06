import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '@/store/uiStore';
import { Icon } from '@/shared/components/Icon';

// ── Keyboard shortcut reference ─────────────────────────────────────────────

const SHORTCUTS = [
  { key: 'Enter', label: 'Roll dice / End turn' },
  { key: 'R',     label: 'Toggle Build Road mode' },
  { key: 'S',     label: 'Toggle Build Settlement mode' },
  { key: 'C',     label: 'Toggle Build City mode' },
  { key: 'K',     label: 'Play Knight card' },
  { key: 'T',     label: 'Open Trade offer' },
  { key: 'Esc',   label: 'Cancel current mode / close modal' },
];

// ── Volume slider ────────────────────────────────────────────────────────────

function VolumeRow() {
  const muted        = useUiStore(s => s.muted);
  const soundVolume  = useUiStore(s => s.soundVolume);
  const toggleMuted  = useUiStore(s => s.toggleMuted);
  const setSoundVolume = useUiStore(s => s.setSoundVolume);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Mute toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)' }}>Sound</span>
        <button
          onClick={toggleMuted}
          className="btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', fontSize: 11.5, fontWeight: 700,
            color: muted ? 'var(--text-ghost)' : 'var(--sapphire-bright)',
            borderColor: muted ? 'var(--hairline)' : 'rgba(63,135,242,0.4)',
          }}
        >
          <Icon name={muted ? 'volume-x' : 'volume'} size={13} color={muted ? 'var(--text-ghost)' : 'var(--sapphire-bright)'} />
          {muted ? 'Muted' : 'On'}
        </button>
      </div>

      {/* Volume slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="volume-x" size={13} color="var(--text-ghost)" />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={soundVolume}
          disabled={muted}
          onChange={e => setSoundVolume(Number(e.target.value))}
          style={{
            flex: 1,
            accentColor: 'var(--sapphire-bright)',
            opacity: muted ? 0.4 : 1,
            cursor: muted ? 'not-allowed' : 'pointer',
          }}
        />
        <Icon name="volume" size={13} color="var(--text-dim)" />
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--ff-mono, monospace)',
          color: 'var(--text-faint)', minWidth: 28, textAlign: 'right',
        }}>
          {soundVolume}
        </span>
      </div>
    </div>
  );
}

// ── Fullscreen toggle ────────────────────────────────────────────────────────

function FullscreenRow() {
  const isFullscreen = !!document.fullscreenElement;

  function toggle() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)' }}>Fullscreen</span>
      <button
        onClick={toggle}
        className="btn"
        style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
      >
        {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      </button>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const showSettings  = useUiStore(s => s.showSettings);
  const setShowSettings = useUiStore(s => s.setShowSettings);

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          key="settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,8,16,0.6)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onClick={() => setShowSettings(false)}
        >
          <motion.div
            key="settings-panel"
            initial={{ scale: 0.94, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="panel"
            style={{ width: 360, maxWidth: '92vw', padding: '20px 20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name="gear" size={16} color="var(--sapphire-bright)" />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '0.01em' }}>Settings</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="btn"
                style={{ width: 28, height: 28, padding: 0, borderRadius: 8, display: 'grid', placeItems: 'center' }}
                aria-label="Close settings"
              >
                <Icon name="close" size={14} color="var(--text-faint)" />
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--hairline)', margin: '-4px 0' }} />

            {/* Sound controls */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Audio</div>
              <VolumeRow />
            </section>

            <div style={{ height: 1, background: 'var(--hairline)' }} />

            {/* Display */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Display</div>
              <FullscreenRow />
            </section>

            <div style={{ height: 1, background: 'var(--hairline)' }} />

            {/* Keyboard shortcuts */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="eyebrow">Keyboard Shortcuts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {SHORTCUTS.map(({ key, label }) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 0',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>{label}</span>
                    <kbd style={{
                      fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--ff-mono, monospace)',
                      padding: '3px 7px', borderRadius: 5,
                      background: 'var(--bg-1)',
                      border: '1px solid var(--glass-brd2)',
                      color: 'var(--text-faint)',
                      lineHeight: 1.4,
                    }}>
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
