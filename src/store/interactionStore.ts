import { create } from 'zustand';
import type { PlayableAction, ResourceType } from '@/shared/types/game';

export type InteractionMode =
  | 'IDLE'
  | 'BUILD_ROAD'
  | 'BUILD_SETTLEMENT'
  | 'BUILD_CITY'
  | 'MOVE_ROBBER'
  | 'DISCARD'
  | 'YEAR_OF_PLENTY'
  | 'MONOPOLY'
  | 'MARITIME_TRADE'
  | 'OFFER_TRADE';

interface TradeSelection {
  giving: ResourceType | null;
  rate: number;
  actions: PlayableAction[];
}

interface DiscardState {
  required: number;
  selected: Partial<Record<ResourceType, number>>;
}

interface MaritimeTradeState {
  giving: ResourceType | null;
  rate: number;
}

interface YopState {
  step: 0 | 1 | 2;
  resource1: ResourceType | null;
}

export type PreviewType = 'settlement' | 'city' | 'road';

interface InteractionStore {
  mode: InteractionMode;
  legalActions: PlayableAction[];
  hoveredNode: number | null;
  hoveredEdge: [number, number] | null;
  hoveredTile: string | null;
  tradeSelection: TradeSelection | null;
  discardState: DiscardState | null;
  maritimeTradeState: MaritimeTradeState | null;
  yopState: YopState | null;
  monopolyPending: boolean;
  /** Suggestion-panel preview — forces a board highlight regardless of current mode. */
  previewNode: number | null;
  previewEdge: [number, number] | null;
  previewTile: string | null;
  previewType: PreviewType | null;

  setMode: (mode: InteractionMode) => void;
  setLegalActions: (actions: PlayableAction[]) => void;
  setHoveredNode: (id: number | null) => void;
  setHoveredEdge: (edge: [number, number] | null) => void;
  setHoveredTile: (key: string | null) => void;
  setTradeSelection: (t: TradeSelection | null) => void;
  setDiscardState: (s: DiscardState | null) => void;
  setMaritimeTradeState: (s: MaritimeTradeState | null) => void;
  setYopState: (s: YopState | null) => void;
  setMonopolyPending: (v: boolean) => void;
  setPreviewHighlight: (node: number | null, edge: [number, number] | null, type: PreviewType | null, tile?: string | null) => void;
  clearPreviewHighlight: () => void;
  resetInteraction: () => void;
}

export const useInteractionStore = create<InteractionStore>(set => ({
  mode: 'IDLE',
  legalActions: [],
  hoveredNode: null,
  hoveredEdge: null,
  hoveredTile: null,
  tradeSelection: null,
  discardState: null,
  maritimeTradeState: null,
  yopState: null,
  monopolyPending: false,
  previewNode: null,
  previewEdge: null,
  previewTile: null,
  previewType: null,

  setMode: (mode) => set({ mode }),
  setLegalActions: (actions) => set({ legalActions: actions }),
  setHoveredNode: (id) => set({ hoveredNode: id }),
  setHoveredEdge: (edge) => set({ hoveredEdge: edge }),
  setHoveredTile: (key) => set({ hoveredTile: key }),
  setTradeSelection: (t) => set({ tradeSelection: t }),
  setDiscardState: (s) => set({ discardState: s }),
  setMaritimeTradeState: (s) => set({ maritimeTradeState: s }),
  setYopState: (s) => set({ yopState: s }),
  setMonopolyPending: (v) => set({ monopolyPending: v }),
  setPreviewHighlight: (node, edge, type, tile = null) => set({ previewNode: node, previewEdge: edge, previewType: type, previewTile: tile }),
  clearPreviewHighlight: () => set({ previewNode: null, previewEdge: null, previewTile: null, previewType: null }),

  resetInteraction: () => set({
    mode: 'IDLE',
    hoveredNode: null,
    hoveredEdge: null,
    hoveredTile: null,
    tradeSelection: null,
    discardState: null,
    maritimeTradeState: null,
    yopState: null,
    monopolyPending: false,
    previewNode: null,
    previewEdge: null,
    previewTile: null,
    previewType: null,
  }),
}));
