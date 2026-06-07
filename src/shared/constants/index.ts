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

export const DEV_CARD_LABELS: Record<string, string> = {
  knight: 'Knight',
  year_of_plenty: 'Year of Plenty',
  monopoly: 'Monopoly',
  road_building: 'Road Building',
  victory_point: 'Victory Point',
};

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
