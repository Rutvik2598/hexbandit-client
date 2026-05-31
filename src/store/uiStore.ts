import { create } from 'zustand';

interface UiStore {
  sidebarTab: 'players' | 'log' | 'analysis';
  showTradeModal: boolean;

  setSidebarTab: (tab: 'players' | 'log' | 'analysis') => void;
  setShowTradeModal: (v: boolean) => void;
}

export const useUiStore = create<UiStore>(set => ({
  sidebarTab: 'players',
  showTradeModal: false,

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setShowTradeModal: (v) => set({ showTradeModal: v }),
}));
