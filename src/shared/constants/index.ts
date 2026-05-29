import type { PlayerColor, ResourceType } from '../types/game';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://staging-api.hexbandit.io';
export const API_KEY = import.meta.env.VITE_API_KEY || '';
export const API_VERSION = '/api/v1';

export const PLAYER_COLORS: Record<PlayerColor, string> = {
  RED: '#ef4444',
  BLUE: '#3b82f6',
  ORANGE: '#f97316',
  WHITE: '#e2e8f0',
  BROWN: '#92400e',
};

export const PLAYER_COLORS_DARK: Record<PlayerColor, string> = {
  RED: '#dc2626',
  BLUE: '#2563eb',
  ORANGE: '#ea580c',
  WHITE: '#cbd5e1',
  BROWN: '#78350f',
};

export const PLAYER_COLORS_BG: Record<PlayerColor, string> = {
  RED: 'rgba(239,68,68,0.15)',
  BLUE: 'rgba(59,130,246,0.15)',
  ORANGE: 'rgba(249,115,22,0.15)',
  WHITE: 'rgba(226,232,240,0.10)',
  BROWN: 'rgba(146,64,14,0.15)',
};

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  wood: '#16a34a',
  brick: '#dc2626',
  sheep: '#84cc16',
  wheat: '#eab308',
  ore: '#6b7280',
};

export const RESOURCE_EMOJI: Record<ResourceType, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛏️',
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  wood: 'Wood',
  brick: 'Brick',
  sheep: 'Sheep',
  wheat: 'Wheat',
  ore: 'Ore',
};

export const RESOURCE_ORDER: ResourceType[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

// Resource index (for API encoding)
export const RESOURCE_BY_INDEX: ResourceType[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
export const RESOURCE_INDEX: Record<ResourceType, number> = {
  wood: 0, brick: 1, sheep: 2, wheat: 3, ore: 4,
};

export const DEV_CARD_LABELS: Record<string, string> = {
  knight: 'Knight',
  year_of_plenty: 'Year of Plenty',
  monopoly: 'Monopoly',
  road_building: 'Road Building',
  victory_point: 'Victory Point',
};

export const DEV_CARD_EMOJI: Record<string, string> = {
  knight: '⚔️',
  year_of_plenty: '🎁',
  monopoly: '💰',
  road_building: '🛤️',
  victory_point: '⭐',
};

export const TILE_RESOURCE_COLORS: Record<string, string> = {
  WOOD: '#15803d',
  BRICK: '#b91c1c',
  SHEEP: '#65a30d',
  WHEAT: '#ca8a04',
  ORE: '#475569',
  DESERT: '#c2a26d',
};

export const TILE_RESOURCE_LABEL: Record<string, string> = {
  WOOD: 'Wood',
  BRICK: 'Brick',
  SHEEP: 'Sheep',
  WHEAT: 'Wheat',
  ORE: 'Ore',
};

export const TILE_RESOURCE_EMOJI: Record<string, string> = {
  WOOD: '🌲',
  BRICK: '🔶',
  SHEEP: '🐑',
  WHEAT: '🌾',
  ORE: '⛰️',
};

// Number token dot counts (for significance)
export const HIGH_PROBABILITY_NUMBERS = new Set([6, 8]);
export const MED_PROBABILITY_NUMBERS = new Set([5, 9]);

// Game
export const WIN_VP = 10;
export const SETTLEMENT_VP = 1;
export const CITY_VP = 2;
export const LONGEST_ROAD_VP = 2;
export const LARGEST_ARMY_VP = 2;

// Poll settings
export const POLL_INTERVAL_MS = 500;
export const POLL_FAST_INTERVAL_MS = 200;
export const POLL_TIMEOUT_MS = 90_000;
export const POLL_BUDGET_FACTOR = 3.0;
export const POLL_BUDGET_FLOOR_MS = POLL_TIMEOUT_MS;
export const POLL_TRANSIENT_MAX = 5;
export const POLL_TRANSIENT_BACKOFF_MS = 1000;

// Eval
export const PWIN_SMOOTH_ALPHA = 0.4;

// Player count options
export const PLAYER_COUNT_OPTIONS = [2, 3, 4] as const;

// Default player colors by index
export const PLAYER_COLOR_BY_INDEX: PlayerColor[] = ['RED', 'BLUE', 'ORANGE', 'WHITE'];
