import { api } from './client';
import type {
  CreateGameRequest,
  GameSession,
  SubmitMoveRequest,
  RecordingResponse,
} from '@/shared/types/api';
import type { GameState } from '@/shared/types/game';

export async function createGame(req: CreateGameRequest): Promise<GameSession> {
  const data = await api.post<GameSession & { id?: string }>('/games/', req);
  // Normalize: some responses use 'id', some 'game_id'
  return {
    ...data,
    game_id: data.game_id || data.id || '',
  };
}

export async function getGameState(gameId: string, options?: {
  perspectiveColor?: string;
  actionLogStart?: number;
}): Promise<GameState> {
  let url = `/games/${gameId}/state`;
  const params: string[] = [];
  if (options?.perspectiveColor) params.push(`perspective=${options.perspectiveColor}`);
  if (options?.actionLogStart !== undefined) params.push(`action_log_start_index=${options.actionLogStart}`);
  if (params.length) url += '?' + params.join('&');

  const response = await api.get<{ state?: GameState } & GameState>(url);
  // The response may nest state in a 'state' field
  return (response.state || response) as GameState;
}

export async function submitMove(
  gameId: string,
  req: SubmitMoveRequest,
): Promise<GameState> {
  const response = await api.post<{ state?: GameState } & GameState>(
    `/games/${gameId}/moves`,
    req,
  );
  return (response.state || response) as GameState;
}

export async function deleteGame(gameId: string): Promise<void> {
  await api.delete(`/games/${gameId}`);
}

export async function getRecording(gameId: string): Promise<RecordingResponse> {
  return api.get<RecordingResponse>(`/games/${gameId}/recording`);
}

export async function getRecordingFrame(gameId: string, step: number): Promise<RecordingResponse> {
  return api.get<RecordingResponse>(`/games/${gameId}/recording/${step}`);
}
