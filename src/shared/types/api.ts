import type { GameState, MoveResult, PwinResult, AnalysisResult, RecordingFrame } from './game';

export interface ApiError {
  message: string;
  status?: number;
  detail?: unknown;
}

// Game session
export interface CreateGameRequest {
  num_players: number;
  player_ids?: string[];
  map_seed?: number;
  config?: {
    friendly_robber?: boolean;
    balanced_dice?: boolean;
    enable_player_trades?: boolean | 'auto';
  };
  externally_managed?: boolean;
  recording?: boolean;
}

export interface GameSession {
  game_id: string;
  id?: string;
  status: string;
  num_players: number;
  action_step?: number;
  player_ids?: string[];
}

export interface GameStateResponse {
  state?: GameState;
  [key: string]: unknown;
}

// Move request
export type MoveRequestStatus = 'pending' | 'thinking' | 'complete' | 'error';

export interface MoveRequestResponse {
  request_id: string;
  game_id?: string | null;
  agent_id: string;
  request_type: 'move' | 'evaluate';
  status: MoveRequestStatus;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  thinking_progress: number;
  thinking_message: string;
  think_time_budget_s?: number | null;
  think_time_elapsed_s?: number | null;
  timed_out: boolean;
  result?: MoveResult | null;
  pwin_result?: PwinResult | null;
  error?: string | null;
}

// Agent
export interface AgentConfig {
  agent_id: string;
  name: string;
  description?: string;
  version?: string;
  aliases?: string[];
  is_alias?: boolean;
  resolves_to?: string | null;
  search?: {
    thinking_time_s?: number | null;
  };
  selection_priority?: number;
  min_players?: number | null;
  max_players?: number | null;
}

export interface AgentsResponse {
  agents: AgentConfig[];
}

// Submit move
export interface SubmitMoveRequest {
  player_id?: string;
  action_type: string;
  action_data: { value?: unknown };
  requested_step?: number;
}

// Evaluate request
export interface EvaluateRequest {
  game_id: string;
  game_state?: GameState;
  perspective_color: string;
  requested_step: number;
}

// Move request
export interface RequestMoveRequest {
  game_id: string;
  agent_id?: string;
  game_state?: GameState;
}

// Analyze request
export interface AnalyzeRequest {
  game_id: string;
  step: number;
  game_state?: GameState;
  action_taken?: {
    action_type: string;
    action_data?: { value?: unknown };
    color: string;
  };
}

// Recording
export interface RecordingResponse {
  frames: RecordingFrame[];
  game_id?: string;
}

export type { AnalysisResult };
