import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useReplayJump } from '@/shared/hooks/useReplayJump';

export default function ReplayControls({ compact = false }: { compact?: boolean }) {
  const replayMode   = useGameStore(s => s.replayMode);
  const replayFrames = useGameStore(s => s.replayFrames);
  const replayStep   = useGameStore(s => s.replayStep);

  const maxStep  = replayFrames.length - 1;
  const goToStep = useReplayJump();

  if (!replayMode) return null;

  const frame  = replayFrames[replayStep];
  const action = frame?.action;
  const pct    = maxStep > 0 ? (replayStep / maxStep) * 100 : 0;

  const transportButtons = [
    { label: '⏮', title: 'First',    onClick: () => goToStep(0),              disabled: replayStep === 0 },
    { label: '◀',  title: 'Previous', onClick: () => goToStep(replayStep - 1), disabled: replayStep === 0 },
    { label: '▶',  title: 'Next',     onClick: () => goToStep(replayStep + 1), disabled: replayStep === maxStep },
    { label: '⏭', title: 'Last',     onClick: () => goToStep(maxStep),        disabled: replayStep === maxStep },
  ];

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--amber-soft)' }}>
            Replay
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)' }}>
            <span style={{ color: 'var(--text-dim)' }}>{replayStep + 1}</span>{' / '}{maxStep + 1}
          </span>
        </div>
        {action && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hairline)', borderRadius: 6, padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-ghost)', marginRight: 4 }}>{action.color}:</span>
            {action.description || action.action_type}
          </div>
        )}
        {/* scrubber */}
        <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 4,
            borderRadius: 4, background: 'var(--glass-hi)', border: '1px solid var(--hairline)',
          }} />
          <div style={{
            position: 'absolute', left: 0, height: 4, borderRadius: 4,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-soft))',
            boxShadow: '0 0 8px var(--amber-glow)',
            transition: 'width 0.1s ease', pointerEvents: 'none',
          }} />
          <input
            type="range" min={0} max={maxStep} value={replayStep}
            onChange={e => goToStep(parseInt(e.target.value))}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
          />
          <div style={{
            position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: 'linear-gradient(180deg, var(--amber-soft), var(--amber))',
            border: '2px solid var(--bg-0)', boxShadow: '0 0 10px var(--amber-glow)',
            pointerEvents: 'none', transition: 'left 0.1s ease',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          {transportButtons.map(btn => (
            <button key={btn.title} onClick={btn.onClick} disabled={btn.disabled} title={btn.title}
              className="btn" style={{ flex: 1, padding: '8px 0', fontSize: 15, display: 'grid', placeItems: 'center', opacity: btn.disabled ? 0.3 : 1 }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '12px 14px',
        minWidth: 280,
      }}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--ff-display)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--amber-soft)',
        }}>
          Replay
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-faint)' }}>
          <span style={{ color: 'var(--text-dim)' }}>{replayStep + 1}</span>
          {' / '}{maxStep + 1}
        </span>
      </div>

      {/* current action label */}
      {action && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-dim)',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hairline)',
          borderRadius: 8, padding: '6px 10px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span style={{ color: 'var(--text-ghost)', marginRight: 6 }}>{action.color}:</span>
          {action.description || action.action_type}
        </div>
      )}

      {/* scrubber */}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          borderRadius: 4, background: 'var(--glass-hi)',
          border: '1px solid var(--hairline)',
        }} />
        {/* fill */}
        <div style={{
          position: 'absolute', left: 0, height: 4, borderRadius: 4,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-soft))',
          boxShadow: '0 0 8px var(--amber-glow)',
          transition: 'width 0.1s ease',
          pointerEvents: 'none',
        }} />
        {/* native input (invisible, sits on top for interaction) */}
        <input
          type="range"
          min={0}
          max={maxStep}
          value={replayStep}
          onChange={e => goToStep(parseInt(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%',
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        {/* thumb dot */}
        <div style={{
          position: 'absolute', left: `${pct}%`,
          transform: 'translateX(-50%)',
          width: 14, height: 14, borderRadius: '50%',
          background: 'linear-gradient(180deg, var(--amber-soft), var(--amber))',
          border: '2px solid var(--bg-0)',
          boxShadow: '0 0 10px var(--amber-glow)',
          pointerEvents: 'none',
          transition: 'left 0.1s ease',
        }} />
      </div>

      {/* transport buttons */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {transportButtons.map(btn => (
          <button
            key={btn.title}
            onClick={btn.onClick}
            disabled={btn.disabled}
            title={btn.title}
            className="btn"
            style={{
              flex: 1, padding: '7px 0', fontSize: 14,
              display: 'grid', placeItems: 'center',
              opacity: btn.disabled ? 0.3 : 1,
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
