import { create } from 'zustand';

interface UiStore {
  sidebarTab: 'players' | 'analysis';
  showTradeModal: boolean;
  showOfferTradeModal: boolean;

  setSidebarTab: (tab: 'players' | 'analysis') => void;
  setShowTradeModal: (v: boolean) => void;
  setShowOfferTradeModal: (v: boolean) => void;
}

export const useUiStore = create<UiStore>(set => ({
  sidebarTab: 'players',
  showTradeModal: false,
  showOfferTradeModal: false,

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setShowTradeModal: (v) => set({ showTradeModal: v }),
  setShowOfferTradeModal: (v) => set({ showOfferTradeModal: v }),
}));
