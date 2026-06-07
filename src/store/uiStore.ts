import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
  // Transient UI state (not persisted)
  sidebarTab: 'players' | 'analysis';
  showTradeModal: boolean;
  showOfferTradeModal: boolean;
  showSettings: boolean;

  // User preferences (persisted to localStorage)
  muted: boolean;
  soundVolume: number; // 0–100

  setSidebarTab: (tab: 'players' | 'analysis') => void;
  setShowTradeModal: (v: boolean) => void;
  setShowOfferTradeModal: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowSettings: (v: boolean) => void;
  toggleMuted: () => void;
  setSoundVolume: (v: number) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarTab: 'players',
      showTradeModal: false,
      showOfferTradeModal: false,
      showSettings: false,

      muted: false,
      soundVolume: 70,

      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      setShowTradeModal: (v) => set({ showTradeModal: v }),
      setShowOfferTradeModal: (v) =>
        set(s => ({ showOfferTradeModal: typeof v === 'function' ? v(s.showOfferTradeModal) : v })),
      setShowSettings: (v) => set({ showSettings: v }),
      toggleMuted: () => set(s => ({ muted: !s.muted })),
      setSoundVolume: (v) => set({ soundVolume: Math.max(0, Math.min(100, v)) }),
    }),
    {
      name: 'hb-preferences',
      partialize: (s) => ({ muted: s.muted, soundVolume: s.soundVolume }),
    }
  )
);
