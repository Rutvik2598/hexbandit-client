import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/store/toastStore';
import type { Toast } from '@/store/toastStore';

// ── Icon per toast type ────────────────────────────────────────────────────

const ICONS: Record<Toast['type'], string> = {
  info:    'ℹ',
  success: '✓',
  error:   '✕',
  warning: '⚠',
};

const ACCENT: Record<Toast['type'], string> = {
  info:    'var(--sapphire-bright)',
  success: '#4ade80',
  error:   '#f87171',
  warning: 'var(--amber)',
};

const BG: Record<Toast['type'], string> = {
  info:    'rgba(63,135,242,0.12)',
  success: 'rgba(74,222,128,0.10)',
  error:   'rgba(248,113,113,0.12)',
  warning: 'rgba(251,191,36,0.10)',
};

// ── Single toast item ──────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore(s => s.removeToast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, removeToast]);

  const accent = ACCENT[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.92 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 14px 11px 12px',
        borderRadius: 12,
        background: BG[toast.type],
        border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        maxWidth: 340,
        width: 'max-content',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => removeToast(toast.id)}
    >
      {/* Icon */}
      <span style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: 6,
        background: `color-mix(in srgb, ${accent} 18%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        display: 'grid',
        placeItems: 'center',
        fontSize: 10,
        fontWeight: 900,
        color: accent,
        marginTop: 1,
      }}>
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <span style={{
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--text)',
        lineHeight: 1.45,
        paddingTop: 1,
      }}>
        {toast.message}
      </span>
    </motion.div>
  );
}

// ── Container ──────────────────────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
