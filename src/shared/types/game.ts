// Core domain types for the Hexbandit game

export type PlayerColor = 'RED' | 'WHITE' | 'BLUE' | 'ORANGE' | 'BROWN';

export type ResourceType = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';

export type DevCardType = 'knight' | 'year_of_plenty' | 'monopoly' | 'road_building' | 'victory_point';

export type BuildingType = 'SETTLEMENT' | 'CITY';

export type GamePhase =
  | 'INITIAL_BUILD'
  | 'PLAY_TURN'
  | 'DISCARDING'
  | 'MOVING_ROBBER'
  | 'ROAD_BUILDING'
  | 'RESOLVING_TRADE'
  | 'DECIDE_ACCEPTEES';

export type ActionType =
  | 'ROLL'
  | 'MOVE_ROBBER'
  | 'DISCARD'
  | 'BUILD_ROAD'
  | 'BUILD_SETTLEMENT'
  | 'BUILD_CITY'
  | 'BUY_DEVELOPMENT_CARD'
  | 'PLAY_KNIGHT_CARD'
  | 'PLAY_YEAR_OF_PLENTY'
  | 'PLAY_MONOPOLY'
  | 'PLAY_ROAD_BUILDING'
  | 'MARITIME_TRADE'
  | 'OFFER_TRADE'
  | 'ACCEPT_TRADE'
  | 'REJECT_TRADE'
  | 'CONFIRM_TRADE'
  | 'CANCEL_TRADE'
  | 'END_TURN';

// Resource counts object
export interface ResourceCounts {
  wood: number;
  brick: number;
  sheep: number;
  wheat: number;
  ore: number;
  [key: string]: number;
}

export interface DevCardCounts {
  knight: number;
  year_of_plenty: number;
  monopoly: number;
  road_building: number;
  victory_point: number;
}

export interface DevCardsOwnedAtStart {
  knight: boolean;
  year_of_plenty: boolean;
  monopoly: boolean;
  road_building: boolean;
}

export interface Player {
  index: number;
  color: PlayerColor;
  name: string;
  victory_points: number;
  resources: ResourceCounts;
  settlements: number;
  cities: number;
  roads_built: number;
  has_longest_road: boolean;
  has_largest_army: boolean;
  longest_road_length: number;
  knights_played: number;
  num_dev_cards: number;
  dev_cards_private: DevCardCounts;
  dev_cards_played: DevCardCounts;
  dev_cards_owned_at_start_private?: DevCardsOwnedAtStart;
  port_resources: (ResourceType | null)[];
  // Server-managed extras
  agent_id?: string;
}

export interface BuildingEntry {
  color: PlayerColor;
  type: BuildingType;
}

export interface TileEntry {
  resource: string | null;
  number: number | null;
}

export interface PortEntry {
  resource: string | null;
  coordinate: [number, number, number];
  nodes?: number[];
}

export interface Board {
  buildings: Record<string, BuildingEntry>;
  roads: Record<string, PlayerColor>;
  tiles: Record<string, TileEntry>;
  robber_coordinate: [number, number, number];
  ports: PortEntry[];
}

export interface GameConfig {
  friendly_robber?: boolean;
  balanced_dice?: boolean;
  enable_player_trades?: boolean | 'auto';
  max_offers_per_turn?: number;
}

// A playable action from the server
export interface PlayableAction {
  action_type: ActionType;
  value: unknown;
}

export interface GameState {
  num_players: number;
  game_config?: GameConfig;
  current_player_index: number;
  current_turn_player_index: number;
  current_turn_player_has_rolled: boolean;
  dev_card_played_this_turn: boolean;
  num_turns: number;
  action_step: number;
  game_phase: GamePhase;
  current_trade: number[];
  acceptees?: boolean[];
  offers_this_turn?: number;
  players: Player[];
  board: Board;
  bank_resources: ResourceCounts;
  dev_deck_private?: DevCardCounts;
  // Server-provided extras
  current_player_agent_id?: string;
  current_player_color?: PlayerColor;
  winner?: PlayerColor | null;
  playable_actions?: PlayableAction[];
  is_trade_allowed?: boolean;
  // Action log — returned when action_log_start_index is passed to state endpoint
  action_log?: ActionLogEvent[];
  action_log_total?: number;
}

// Win probability by color
export type PwinByColor = Record<string, number>;

export interface ActionPwin {
  action_label: string;
  pwin_by_color: PwinByColor;
  confidence: number;
  /** Raw action value from the server — present when the API includes it. */
  value?: unknown;
}

export interface PwinResult {
  perspective: string;
  pwin: number[];
  pwin_by_color: PwinByColor;
  actions_pwin?: ActionPwin[];
}

// Move action as returned from agent
export interface MoveResult {
  action_type: ActionType;
  action_data: { value?: unknown };
  reasoning?: string;
  pwin_by_color?: PwinByColor;
  timed_out: boolean;
}

// Analysis result
export interface ActionRecord {
  action_type: string;
  value: unknown;
  color: string;
  description?: string | null;
  pwin_by_color?: PwinByColor | null;
}

export interface AnalysisResult {
  game_id?: string;
  step: number;
  acting_player?: string | null;
  action_taken?: ActionRecord | null;
  best_action?: ActionRecord | null;
  win_probability_delta?: string | null;
  explanation?: string | null;
  explanation_error?: string | null;
  evaluate?: {
    pwin_by_color?: PwinByColor;
    actions_pwin?: ActionPwin[];
  } | null;
}

// Server action log event (returned by GET /games/{id}/state?action_log_start_index=N)
export interface ActionLogEvent {
  action_type: string;
  color: string;
  value: unknown;
  result?: unknown;
  card_stolen?: boolean;
}

// Recording frame
export interface RecordingFrame {
  turn?: number;
  action?: ActionRecord;
  state?: GameState;
  evaluate?: {
    pwin_by_color?: PwinByColor;
    actions_pwin?: ActionPwin[];
  };
}

// Coordinate helpers
export type CubeCoord = [number, number, number];
export type NodeId = number;
export type EdgeId = [NodeId, NodeId];
