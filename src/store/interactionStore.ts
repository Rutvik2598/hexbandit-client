import { create } from 'zustand';

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

export type PreviewType = 'settlement' | 'city' | 'road';

interface InteractionStore {
  mode: InteractionMode;
  hoveredNode: number | null;
  hoveredEdge: [number, number] | null;
  hoveredTile: string | null;
  /** Suggestion-panel preview — forces a board highlight regardless of current mode. */
  previewNode: number | null;
  previewEdge: [number, number] | null;
  previewTile: string | null;
  previewType: PreviewType | null;

  setMode: (mode: InteractionMode) => void;
  setHoveredNode: (id: number | null) => void;
  setHoveredEdge: (edge: [number, number] | null) => void;
  setHoveredTile: (key: string | null) => void;
  setPreviewHighlight: (node: number | null, edge: [number, number] | null, type: PreviewType | null, tile?: string | null) => void;
  clearPreviewHighlight: () => void;
  resetInteraction: () => void;
}

export const useInteractionStore = create<InteractionStore>(set => ({
  mode: 'IDLE',
  hoveredNode: null,
  hoveredEdge: null,
  hoveredTile: null,
  previewNode: null,
  previewEdge: null,
  previewTile: null,
  previewType: null,

  setMode: (mode) => set({ mode }),
  setHoveredNode: (id) => set({ hoveredNode: id }),
  setHoveredEdge: (edge) => set({ hoveredEdge: edge }),
  setHoveredTile: (key) => set({ hoveredTile: key }),
  setPreviewHighlight: (node, edge, type, tile = null) => set({ previewNode: node, previewEdge: edge, previewType: type, previewTile: tile }),
  clearPreviewHighlight: () => set({ previewNode: null, previewEdge: null, previewTile: null, previewType: null }),

  resetInteraction: () => set({
    mode: 'IDLE',
    hoveredNode: null,
    hoveredEdge: null,
    hoveredTile: null,
    previewNode: null,
    previewEdge: null,
    previewTile: null,
    previewType: null,
  }),
}));
