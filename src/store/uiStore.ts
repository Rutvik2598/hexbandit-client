import { create } from 'zustand';

interface UiStore {
  showAnalysisPanel: boolean;
  showGameLog: boolean;
  showApiKeyModal: boolean;
  apiKeyInput: string;
  apiKeyValid: boolean | null;
  isTestingApiKey: boolean;
  sidebarTab: 'players' | 'log' | 'analysis';

  setShowAnalysisPanel: (v: boolean) => void;
  setShowGameLog: (v: boolean) => void;
  setShowApiKeyModal: (v: boolean) => void;
  setApiKeyInput: (v: string) => void;
  setApiKeyValid: (v: boolean | null) => void;
  setIsTestingApiKey: (v: boolean) => void;
  setSidebarTab: (tab: 'players' | 'log' | 'analysis') => void;
}

export const useUiStore = create<UiStore>(set => ({
  showAnalysisPanel: false,
  showGameLog: true,
  showApiKeyModal: false,
  apiKeyInput: '',
  apiKeyValid: null,
  isTestingApiKey: false,
  sidebarTab: 'players',

  setShowAnalysisPanel: (v) => set({ showAnalysisPanel: v }),
  setShowGameLog: (v) => set({ showGameLog: v }),
  setShowApiKeyModal: (v) => set({ showApiKeyModal: v }),
  setApiKeyInput: (v) => set({ apiKeyInput: v }),
  setApiKeyValid: (v) => set({ apiKeyValid: v }),
  setIsTestingApiKey: (v) => set({ isTestingApiKey: v }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
}));
