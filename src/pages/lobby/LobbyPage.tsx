import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { getAgents, testApiKey as testKey } from '@/services/api/agentsApi';
import { createGame } from '@/services/api/gamesApi';
import { setApiKey, getApiKey } from '@/services/api/client';
import { useGameStore } from '@/store/gameStore';
import type { AgentConfig } from '@/shared/types/api';
import { PLAYER_COLORS, PLAYER_COLOR_BY_INDEX } from '@/shared/constants';

const PLAYER_COUNT_OPTIONS = [2, 3, 4] as const;

interface PlayerSlot {
  agentId: string;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const resetGame = useGameStore(s => s.reset);
  const setGameId = useGameStore(s => s.setGameId);
  const addLog = useGameStore(s => s.addLog);

  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(4);
  const [slots, setSlots] = useState<PlayerSlot[]>([
    { agentId: 'human' },
    { agentId: '' },
    { agentId: '' },
    { agentId: '' },
  ]);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [friendlyRobber, setFriendlyRobber] = useState(false);
  const [mapSeed, setMapSeed] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadAgents = useCallback(async (count: number) => {
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const list = await getAgents(count);
      // Ensure arch-* bots come first
      const sorted = [...list].sort((a, b) => (b.selection_priority || 0) - (a.selection_priority || 0));
      setAgents(sorted);
      const bestAi = sorted.find(a => a.agent_id !== 'human')?.agent_id || 'arch-expert-rl';
      setSlots(prev => prev.map((s, i) => ({
        agentId: s.agentId || (i === 0 ? 'human' : bestAi),
      })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setAgentsError(msg);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents(numPlayers);
  }, [numPlayers, loadAgents]);

  useEffect(() => {
    if (apiKeyInput) {
      setApiKey(apiKeyInput);
    }
  }, [apiKeyInput]);

  const handleTestKey = async () => {
    if (!apiKeyInput.trim()) return;
    setApiKey(apiKeyInput.trim());
    setApiKeyStatus('testing');
    const valid = await testKey();
    setApiKeyStatus(valid ? 'valid' : 'invalid');
    if (valid) loadAgents(numPlayers);
  };

  const handleNumPlayersChange = (n: 2 | 3 | 4) => {
    setNumPlayers(n);
    // Trim or extend slots
    setSlots(prev => {
      const extended = [...prev];
      while (extended.length < n) extended.push({ agentId: '' });
      return extended.slice(0, n);
    });
  };

  const handleSlotChange = (index: number, agentId: string) => {
    setSlots(prev => prev.map((s, i) => i === index ? { agentId } : s));
  };

  const handleStartGame = async () => {
    setCreating(true);
    setCreateError(null);
    resetGame();

    try {
      const playerSlots = slots.slice(0, numPlayers);
      const playerIds = playerSlots.map(s => s.agentId || 'arch-expert-rl');

      const session = await createGame({
        num_players: numPlayers,
        player_ids: playerIds,
        recording: true,
        config: { friendly_robber: friendlyRobber },
        ...(mapSeed ? { map_seed: parseInt(mapSeed) } : {}),
      });

      const gameId = session.game_id;
      setGameId(gameId);
      // Human player indices are resolved from the actual game state in GamePage

      addLog(`Game created (${gameId.slice(0, 8)}…)`, 'success');
      navigate('/game');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const humanOption: AgentConfig = {
    agent_id: 'human',
    name: '🎮 Human Player',
    selection_priority: -1,
  };

  const agentOptions = [humanOption, ...agents.filter(a => a.agent_id !== 'human')];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-800/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎲</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hexbandit</h1>
          <p className="text-slate-400 text-sm mt-1">Catan AI Engine</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          {/* API Key */}
          <div className="p-5 border-b border-slate-700/50">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTestKey()}
                placeholder="cat_..."
                className={clsx(
                  'flex-1 bg-slate-800 border rounded-xl px-3 py-2 text-sm text-slate-200',
                  'placeholder-slate-600 outline-none transition-all',
                  apiKeyStatus === 'valid' && 'border-green-600/60',
                  apiKeyStatus === 'invalid' && 'border-red-600/60',
                  (apiKeyStatus === 'idle' || apiKeyStatus === 'testing') && 'border-slate-600',
                  'focus:border-blue-500/60',
                )}
              />
              <button
                onClick={handleTestKey}
                disabled={!apiKeyInput.trim() || apiKeyStatus === 'testing'}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  'border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {apiKeyStatus === 'testing' ? '…' : 'Test'}
              </button>
            </div>
            {apiKeyStatus === 'valid' && (
              <p className="text-xs text-green-400 mt-1">✓ API key valid</p>
            )}
            {apiKeyStatus === 'invalid' && (
              <p className="text-xs text-red-400 mt-1">✗ Invalid API key</p>
            )}
          </div>

          {/* Game Settings */}
          <div className="p-5 space-y-5">
            {/* Player count */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Players
              </label>
              <div className="flex gap-2">
                {PLAYER_COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => handleNumPlayersChange(n)}
                    className={clsx(
                      'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                      numPlayers === n
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700',
                    )}
                  >
                    {n}P
                  </button>
                ))}
              </div>
            </div>

            {/* Player slots */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Player Setup
              </label>
              {agentsLoading ? (
                <div className="text-xs text-slate-500 text-center py-4">Loading agents…</div>
              ) : agentsError ? (
                <div className="text-xs text-red-400 bg-red-950/20 border border-red-800/30 rounded-xl p-3">
                  Failed to load agents: {agentsError}
                  <button onClick={() => loadAgents(numPlayers)} className="ml-2 underline hover:no-underline">
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {slots.slice(0, numPlayers).map((slot, i) => {
                    const color = PLAYER_COLOR_BY_INDEX[i];
                    const playerColor = PLAYER_COLORS[color];
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-black/20"
                          style={{ backgroundColor: playerColor }}
                        />
                        <span className="text-xs text-slate-500 w-16 flex-shrink-0">
                          {color}
                        </span>
                        <select
                          value={slot.agentId}
                          onChange={e => handleSlotChange(i, e.target.value)}
                          className={clsx(
                            'flex-1 bg-slate-800 border border-slate-600 rounded-xl',
                            'px-3 py-2 text-sm text-slate-200 outline-none',
                            'focus:border-blue-500/60 transition-all',
                          )}
                        >
                          {agentOptions
                            .filter(a => {
                              if (!a.min_players && !a.max_players) return true;
                              if (a.min_players && numPlayers < a.min_players) return false;
                              if (a.max_players && numPlayers > a.max_players) return false;
                              return true;
                            })
                            .map(agent => (
                              <option key={agent.agent_id} value={agent.agent_id}>
                                {agent.name}
                                {agent.search?.thinking_time_s
                                  ? ` (${agent.search.thinking_time_s}s)`
                                  : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={friendlyRobber}
                  onChange={e => setFriendlyRobber(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                />
                <span className="text-xs text-slate-400">Friendly Robber</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Map Seed</span>
                <input
                  type="number"
                  value={mapSeed}
                  onChange={e => setMapSeed(e.target.value)}
                  placeholder="random"
                  className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none"
                />
              </div>
            </div>

            {/* Create error */}
            {createError && (
              <div className="text-xs text-red-400 bg-red-950/20 border border-red-800/30 rounded-xl p-3">
                {createError}
              </div>
            )}

            {/* Start button */}
            <button
              onClick={handleStartGame}
              disabled={creating || agentsLoading}
              className={clsx(
                'w-full py-3 rounded-xl font-semibold text-sm transition-all',
                'bg-blue-600 hover:bg-blue-500 text-white shadow-lg',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:shadow-blue-500/25 hover:shadow-xl',
              )}
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating game…
                </span>
              ) : (
                '▶ Start Game'
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Powered by Hexbandit API · staging-api.hexbandit.io
        </p>
      </motion.div>
    </div>
  );
}
