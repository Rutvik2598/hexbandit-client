import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Auto-dismiss delay in ms. Defaults: error = 6 000, others = 4 000. */
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

let _nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', duration) => {
    const id = String(++_nextId);
    const resolvedDuration = duration ?? (type === 'error' ? 6000 : 4000);
    set(s => ({ toasts: [...s.toasts.slice(-4), { id, type, message, duration: resolvedDuration }] }));
  },

  removeToast: (id) =>
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

/** Convenience helper — callable outside React components. */
export function addToast(message: string, type: ToastType = 'info', duration?: number) {
  useToastStore.getState().addToast(message, type, duration);
}
