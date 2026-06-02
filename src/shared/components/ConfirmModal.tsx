import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm, onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'grid', placeItems: 'center',
            background: 'rgba(4,8,16,0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="panel"
            style={{
              width: 380, maxWidth: '90vw',
              padding: '28px 28px 22px',
              background: 'var(--glass-2)',
              boxShadow: 'var(--sh-pop)',
              borderRadius: 'var(--r-xl)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            {/* icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: danger
                  ? 'color-mix(in srgb, #ef4444 18%, transparent)'
                  : 'color-mix(in srgb, var(--amber) 18%, transparent)',
                border: `1px solid ${danger ? 'rgba(239,68,68,0.35)' : 'var(--amber-deep)'}`,
              }}>
                <Icon
                  name="close"
                  size={18}
                  color={danger ? '#f87171' : 'var(--amber-soft)'}
                />
              </span>
              <h2 style={{
                fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 18,
                margin: 0, letterSpacing: '0.02em', color: 'var(--text)',
              }}>
                {title}
              </h2>
            </div>

            {/* message */}
            <p style={{
              margin: 0, fontSize: 13.5, lineHeight: 1.6,
              color: 'var(--text-dim)',
              paddingLeft: 52,
            }}>
              {message}
            </p>

            {/* divider */}
            <div style={{ height: 1, background: 'var(--hairline)' }} />

            {/* actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                className="btn"
                style={{ padding: '10px 22px', fontSize: 13, fontWeight: 700 }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`btn${danger ? '' : ' btn-primary'}`}
                style={{
                  padding: '10px 22px', fontSize: 13, fontWeight: 800,
                  ...(danger ? {
                    background: 'linear-gradient(180deg,#f87171,#ef4444)',
                    borderColor: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    boxShadow: '0 8px 24px -6px rgba(239,68,68,0.5)',
                  } : {}),
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
