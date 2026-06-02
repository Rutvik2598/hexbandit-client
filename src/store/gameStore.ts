import { create } from 'zustand';
import type { GameState, PwinByColor, PwinResult, AnalysisResult, RecordingFrame, PlayerColor } from '@/shared/types/game';
import { PWIN_SMOOTH_ALPHA } from '@/shared/constants';

type ThinkingPhase = 'idle' | 'submitting' | 'thinking' | 'applying' | 'done' | 'error';

interface ThinkingState {
  phase: ThinkingPhase;
  message: string;
  progress: number;
  budgetS: number | null;
  elapsedS: number | null;
}

interface LogEntry {
  id: number;
  turn: number;
  message: string;
  level: 'info' | 'error' | 'success' | 'action';
  html?: boolean;
  timestamp: number;
}

interface GameStore {
  // Session
  gameId: string | null;
  humanPlayerIndices: number[];
  perspectiveColor: PlayerColor | null;

  // Game state
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;

  // Thinking/polling
  thinking: ThinkingState;

  // Eval bar
  lastPwin: PwinByColor | null;
  lastPwinStep: number;
  isEvaluating: boolean;

  // Log
  logEntries: LogEntry[];
  _logId: number;

  // Replay
  replayMode: boolean;
  replayFrames: RecordingFrame[];
  replayStep: number;
  replayAnalysis: AnalysisResult | null;
  replayAnalysisLoading: boolean;

  // Auto-play
  autoPlaying: boolean;

  // Resource gains after a roll (player COLOR → resource deltas)
  resourceGains: Record<string, Partial<Record<string, number>>> | null;

  // Last rolled dice [d1, d2] — extracted from action log ROLL event
  lastRollDice: [number, number] | null;

  // Tracks how many action log events have been synced from server
  actionLogTotal: number;

  // Actions
  setGameId: (id: string | null) => void;
  setHumanPlayers: (indices: number[]) => void;
  setPerspectiveColor: (color: PlayerColor | null) => void;
  setGameState: (state: GameState | null) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setThinking: (t: Partial<ThinkingState>) => void;
  clearThinking: () => void;
  updatePwin: (result: PwinResult) => void;
  clearPwin: () => void;
  setEvaluating: (v: boolean) => void;
  addLog: (message: string, level?: LogEntry['level'], html?: boolean) => void;
  clearLog: () => void;
  setReplayMode: (v: boolean) => void;
  setReplayFrames: (frames: RecordingFrame[]) => void;
  setReplayStep: (step: number) => void;
  setReplayAnalysis: (a: AnalysisResult | null) => void;
  setReplayAnalysisLoading: (v: boolean) => void;
  setAutoPlaying: (v: boolean) => void;
  setResourceGains: (gains: Record<string, Partial<Record<string, number>>> | null) => void;
  setLastRollDice: (dice: [number, number] | null) => void;
  setActionLogTotal: (n: number) => void;
  reset: () => void;
}

const INITIAL_THINKING: ThinkingState = {
  phase: 'idle',
  message: '',
  progress: 0,
  budgetS: null,
  elapsedS: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  humanPlayerIndices: [],
  perspectiveColor: null,
  gameState: null,
  isLoading: false,
  error: null,
  thinking: INITIAL_THINKING,
  lastPwin: null,
  lastPwinStep: -1,
  isEvaluating: false,
  logEntries: [],
  _logId: 0,
  replayMode: false,
  replayFrames: [],
  replayStep: 0,
  replayAnalysis: null,
  replayAnalysisLoading: false,
  autoPlaying: false,
  resourceGains: null,
  lastRollDice: null,
  actionLogTotal: 0,

  setGameId: (id) => set({ gameId: id }),
  setHumanPlayers: (indices) => set({ humanPlayerIndices: indices }),
  setPerspectiveColor: (color) => set({ perspectiveColor: color }),
  setGameState: (state) => set({ gameState: state }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),

  setThinking: (t) =>
    set(s => ({ thinking: { ...s.thinking, ...t } })),

  clearThinking: () =>
    set({ thinking: INITIAL_THINKING }),

  updatePwin: (result) => {
    const { lastPwin } = get();
    const newPwin = result.pwin_by_color;

    // EMA smoothing
    const numColors = Object.keys(newPwin).length || 1;
    let prior = lastPwin;
    if (!prior) {
      prior = {};
      for (const color of Object.keys(newPwin)) {
        prior[color] = 1.0 / numColors;
      }
    }

    const smoothed: PwinByColor = {};
    let total = 0;
    for (const color of Object.keys(newPwin)) {
      const prev = prior[color] ?? newPwin[color];
      smoothed[color] = PWIN_SMOOTH_ALPHA * newPwin[color] + (1 - PWIN_SMOOTH_ALPHA) * prev;
      total += smoothed[color];
    }
    if (total > 0) {
      for (const color of Object.keys(smoothed)) {
        smoothed[color] /= total;
      }
    }

    const gameState = get().gameState;
    set({
      lastPwin: smoothed,
      lastPwinStep: gameState?.action_step ?? 0,
    });
  },

  clearPwin: () => set({ lastPwin: null, lastPwinStep: -1 }),

  setEvaluating: (v) => set({ isEvaluating: v }),

  addLog: (message, level = 'info', html = false) =>
    set(s => {
      const id = s._logId + 1;
      const entry: LogEntry = {
        id,
        turn: s.gameState?.num_turns ?? 0,
        message,
        level,
        html,
        timestamp: Date.now(),
      };
      // Keep last 200 entries
      const entries = [...s.logEntries, entry].slice(-200);
      return { logEntries: entries, _logId: id };
    }),

  clearLog: () => set({ logEntries: [], _logId: 0 }),

  setReplayMode: (v) => set({ replayMode: v }),
  setReplayFrames: (frames) => set({ replayFrames: frames }),
  setReplayStep: (step) => set({ replayStep: step }),
  setReplayAnalysis: (a) => set({ replayAnalysis: a }),
  setReplayAnalysisLoading: (v) => set({ replayAnalysisLoading: v }),
  setAutoPlaying: (v) => set({ autoPlaying: v }),
  setResourceGains: (gains) => set({ resourceGains: gains }),
  setLastRollDice: (dice) => set({ lastRollDice: dice }),
  setActionLogTotal: (n) => set({ actionLogTotal: n }),

  reset: () => set({
    gameId: null,
    humanPlayerIndices: [],
    perspectiveColor: null,
    gameState: null,
    isLoading: false,
    error: null,
    thinking: INITIAL_THINKING,
    lastPwin: null,
    lastPwinStep: -1,
    isEvaluating: false,
    logEntries: [],
    _logId: 0,
    replayMode: false,
    replayFrames: [],
    replayStep: 0,
    replayAnalysis: null,
    replayAnalysisLoading: false,
    autoPlaying: false,
    resourceGains: null,
    lastRollDice: null,
    actionLogTotal: 0,
  }),
}));
