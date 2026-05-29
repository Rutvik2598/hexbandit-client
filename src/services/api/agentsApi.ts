import { api } from './client';
import type { AgentConfig } from '@/shared/types/api';

export interface AgentsListResponse {
  agents: AgentConfig[];
}

export async function getAgents(numPlayers?: number): Promise<AgentConfig[]> {
  const url = numPlayers ? `/agents?num_players=${numPlayers}` : '/agents';
  const data = await api.get<AgentsListResponse | AgentConfig[]>(url);
  // Handle both shapes
  if (Array.isArray(data)) return data;
  return data.agents || [];
}

export async function testApiKey(): Promise<boolean> {
  try {
    await api.get('/agents');
    return true;
  } catch {
    return false;
  }
}
