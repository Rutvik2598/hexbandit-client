import { create } from 'zustand';

interface UiStore {
  sidebarTab: 'players' | 'analysis';
  showTradeModal: boolean;
  showOfferTradeModal: boolean;
  muted: boolean;

  setSidebarTab: (tab: 'players' | 'analysis') => void;
  setShowTradeModal: (v: boolean) => void;
  setShowOfferTradeModal: (v: boolean) => void;
  toggleMuted: () => void;
}

export const useUiStore = create<UiStore>(set => ({
  sidebarTab: 'players',
  showTradeModal: false,
  showOfferTradeModal: false,
  muted: localStorage.getItem('hb_muted') === 'true',

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setShowTradeModal: (v) => set({ showTradeModal: v }),
  setShowOfferTradeModal: (v) => set({ showOfferTradeModal: v }),
  toggleMuted: () => set(s => {
    const next = !s.muted;
    localStorage.setItem('hb_muted', String(next));
    return { muted: next };
  }),
}));
