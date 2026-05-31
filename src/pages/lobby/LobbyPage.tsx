import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getAgents, testApiKey as testKey } from '@/services/api/agentsApi';
import { createGame } from '@/services/api/gamesApi';
import { setApiKey, getApiKey } from '@/services/api/client';
import { useGameStore } from '@/store/gameStore';
import { Icon } from '@/shared/components/Icon';
import type { AgentConfig } from '@/shared/types/api';
import { PLAYER_COLORS, PLAYER_COLOR_BY_INDEX, PLAYER_COUNT_OPTIONS } from '@/shared/constants';

interface PlayerSlot { agentId: string }

// ── Custom bot selector dropdown ────────────────────────────────────────────

interface BotSelectProps {
  value: string;
  options: AgentConfig[];
  onChange: (id: string) => void;
  disabled?: boolean;
}

function BotSelect({ value, options, onChange, disabled }: BotSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedLabel = options.find(o => o.agent_id === value)?.name ?? value;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '11px 14px', borderRadius: 11,
          background: disabled ? 'rgba(255,255,255,0.03)' : 'var(--glass-hi)',
          border: `1px solid var(--glass-brd)`,
          color: disabled ? 'var(--text-faint)' : 'var(--text)',
          fontFamily: 'var(--ff-ui)', fontWeight: 600, fontSize: 14.5,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'border-color .15s, background .15s',
        }}
        onMouseEnter={e => !disabled && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-brd2)')}
        onMouseLeave={e => !disabled && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-brd)')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <Icon name="robot" size={17} color="var(--text-dim)" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedLabel}
          </span>
        </span>
        {!disabled && (
          <span style={{
            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s',
            color: 'var(--text-faint)', display: 'flex', flexShrink: 0,
          }}>
            <Icon name="chevron" size={16} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="panel"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
              padding: 6, borderRadius: 12, background: 'var(--glass-2)',
              maxHeight: 260, overflowY: 'auto',
            }}
          >
            {options.map(opt => {
              const isSelected = opt.agent_id === value;
              const label = opt.name + (opt.search?.thinking_time_s ? ` (${opt.search.thinking_time_s}s)` : '');
              return (
                <button
                  key={opt.agent_id}
                  onClick={() => { onChange(opt.agent_id); setOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '10px 12px', borderRadius: 8, border: 'none',
                    background: isSelected ? 'var(--sapphire)' : 'transparent',
                    color: 'var(--text)', fontFamily: 'var(--ff-ui)', fontWeight: 600, fontSize: 14,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Icon name={opt.agent_id === 'human' ? 'user' : 'robot'} size={16}
                    color={isSelected ? '#fff' : 'var(--text-dim)'} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  {isSelected && (
                    <span style={{ display: 'flex', flexShrink: 0 }}>
                      <Icon name="check" size={15} color="#fff" />
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main lobby page ──────────────────────────────────────────────────────────

export default function LobbyPage() {
  const navigate   = useNavigate();
  const resetGame  = useGameStore(s => s.reset);
  const setGameId  = useGameStore(s => s.setGameId);
  const addLog     = useGameStore(s => s.addLog);

  const [apiKeyInput, setApiKeyInput]   = useState(getApiKey());
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [showApiKey, setShowApiKey]     = useState(!getApiKey());
  const [numPlayers, setNumPlayers]     = useState<2 | 3 | 4>(4);
  const [slots, setSlots]               = useState<PlayerSlot[]>([
    { agentId: 'human' }, { agentId: '' }, { agentId: '' }, { agentId: '' },
  ]);
  const [agents, setAgents]             = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError]   = useState<string | null>(null);
  const [friendlyRobber, setFriendlyRobber] = useState(false);
  const [mapSeed, setMapSeed]           = useState('');
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);

  const loadAgents = useCallback(async (count: number) => {
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const list   = await getAgents(count);
      const sorted = [...list].sort((a, b) => (b.selection_priority || 0) - (a.selection_priority || 0));
      setAgents(sorted);
      const bestAi = sorted.find(a => a.agent_id !== 'human')?.agent_id || 'arch-expert-rl';
      setSlots(prev => prev.map((s, i) => ({
        agentId: s.agentId || (i === 0 ? 'human' : bestAi),
      })));
    } catch (e) {
      setAgentsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(numPlayers); }, [numPlayers, loadAgents]);
  useEffect(() => { if (apiKeyInput) setApiKey(apiKeyInput); }, [apiKeyInput]);

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
    setSlots(prev => {
      const extended = [...prev];
      while (extended.length < n) extended.push({ agentId: '' });
      return extended.slice(0, n);
    });
  };

  const handleStartGame = async () => {
    setCreating(true);
    setCreateError(null);
    resetGame();
    try {
      const playerIds = slots.slice(0, numPlayers).map(s => s.agentId || 'arch-expert-rl');
      const session   = await createGame({
        num_players: numPlayers,
        player_ids: playerIds,
        recording: true,
        config: { friendly_robber: friendlyRobber },
        ...(mapSeed ? { map_seed: parseInt(mapSeed) } : {}),
      });
      setGameId(session.game_id);
      addLog(`Game created (${session.game_id.slice(0, 8)}…)`, 'success');
      navigate('/game');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const humanOption: AgentConfig = { agent_id: 'human', name: 'Human Player', selection_priority: -1 };
  const agentOptions = [humanOption, ...agents.filter(a => a.agent_id !== 'human')];

  const activeColors = Array.from({ length: numPlayers }, (_, i) => PLAYER_COLOR_BY_INDEX[i]);

  const colorLabels: Record<string, string> = { RED: 'RED', BLUE: 'BLUE', ORANGE: 'ORANGE', WHITE: 'WHITE' };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto' }}>
      <div className="atmos" />

      {/* blue radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(520px 380px at 50% 32%, rgba(47,116,240,0.16), transparent 70%)',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', width: 560, maxWidth: '92vw', padding: '48px 0 40px' }}
      >
        {/* ── Crest + Title ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
          {/* hexagonal crest */}
          <div style={{ position: 'relative', width: 78, height: 86, marginBottom: 14 }}>
            <svg width="78" height="86" viewBox="0 0 78 86"
              style={{ filter: 'drop-shadow(0 8px 22px rgba(47,116,240,0.45))' }}>
              <path d="M39 2L73 21V64L39 84L5 64V21Z" fill="url(#crestg)" stroke="var(--amber)" strokeWidth="2" />
              <path d="M39 2L73 21V64L39 84L5 64V21Z" fill="none"
                stroke="rgba(255,255,255,0.18)" strokeWidth="1" transform="scale(0.9) translate(4.3,4.7)" />
              <defs>
                <linearGradient id="crestg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1f3f70" />
                  <stop offset="1" stopColor="#0d2244" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <svg width="34" height="34" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb" />
                <circle cx="8" cy="8" r="1.6" fill="#0e2244" />
                <circle cx="16" cy="16" r="1.6" fill="#0e2244" />
                <circle cx="12" cy="12" r="1.6" fill="var(--p-red)" />
                <circle cx="16" cy="8" r="1.6" fill="#0e2244" />
                <circle cx="8" cy="16" r="1.6" fill="#0e2244" />
              </svg>
            </div>
          </div>

          <h1 style={{
            fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 52,
            margin: 0, letterSpacing: '0.04em',
            background: 'linear-gradient(180deg,#fff,#bcd0ee)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            HEXBANDIT
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ height: 1, width: 34, background: 'var(--amber)', opacity: 0.6 }} />
            <span className="eyebrow" style={{ color: 'var(--amber-soft)', letterSpacing: '0.32em' }}>
              Catan&nbsp;AI&nbsp;Engine
            </span>
            <span style={{ height: 1, width: 34, background: 'var(--amber)', opacity: 0.6 }} />
          </div>
        </div>

        {/* ── Config panel ── */}
        <div className="panel" style={{ padding: 26 }}>

          {/* API Key (collapsible) */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showApiKey ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="eyebrow">API Key</div>
                {apiKeyStatus === 'valid' && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4ade80', letterSpacing: '0.04em' }}>✓ valid</span>
                )}
                {apiKeyStatus === 'invalid' && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#f87171', letterSpacing: '0.04em' }}>✗ invalid</span>
                )}
              </div>
              <button
                onClick={() => setShowApiKey(v => !v)}
                style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-faint)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--ff-ui)', letterSpacing: '0.08em',
                }}
              >
                {showApiKey ? 'Hide' : 'Edit'}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showApiKey && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTestKey()}
                      placeholder="cat_..."
                      style={{
                        flex: 1, background: 'var(--bg-1)',
                        border: `1px solid ${
                          apiKeyStatus === 'valid' ? 'rgba(74,222,128,0.5)' :
                          apiKeyStatus === 'invalid' ? 'rgba(248,113,113,0.5)' :
                          'var(--glass-brd)'
                        }`,
                        borderRadius: 10, padding: '10px 13px',
                        fontSize: 13.5, color: 'var(--text)', outline: 'none',
                        fontFamily: 'var(--ff-ui)',
                      }}
                    />
                    <button
                      onClick={handleTestKey}
                      disabled={!apiKeyInput.trim() || apiKeyStatus === 'testing'}
                      className="btn"
                      style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
                    >
                      {apiKeyStatus === 'testing' ? '…' : 'Test'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--hairline)', margin: '0 0 22px' }} />

          {/* Player count */}
          <div className="eyebrow" style={{ marginBottom: 12 }}>Players</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {PLAYER_COUNT_OPTIONS.map(n => {
              const on = numPlayers === n;
              return (
                <button key={n} onClick={() => handleNumPlayersChange(n)} className="btn"
                  style={{
                    padding: '16px 0', fontSize: 17,
                    fontFamily: 'var(--ff-display)', letterSpacing: '0.04em',
                    background: on
                      ? 'linear-gradient(180deg,var(--sapphire-bright),var(--sapphire))'
                      : 'var(--glass-hi)',
                    borderColor: on ? 'rgba(255,255,255,0.2)' : 'var(--glass-brd)',
                    boxShadow: on
                      ? '0 8px 24px -6px var(--sapphire-glow), 0 1px 0 rgba(255,255,255,0.25) inset'
                      : 'none',
                  }}
                >
                  {n}&nbsp;Players
                </button>
              );
            })}
          </div>

          {/* Player slots */}
          <div className="eyebrow" style={{ marginBottom: 12 }}>Player Setup</div>

          {agentsLoading ? (
            <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-ghost)', fontSize: 13 }}>
              Loading agents…
            </div>
          ) : agentsError ? (
            <div style={{
              fontSize: 12.5, color: '#f87171',
              background: 'rgba(220,50,50,0.07)', border: '1px solid rgba(220,50,50,0.18)',
              borderRadius: 10, padding: '11px 14px', marginBottom: 4,
            }}>
              Failed to load agents: {agentsError}
              <button onClick={() => loadAgents(numPlayers)}
                style={{ marginLeft: 10, color: 'var(--sapphire-bright)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--ff-ui)' }}>
                Retry
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeColors.map((colorKey, i) => {
                const hex = PLAYER_COLORS[colorKey] || '#ccc';
                const label = colorLabels[colorKey] ?? colorKey;
                const isHuman = i === 0;
                return (
                  <div key={colorKey} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Color dot + label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 96, flexShrink: 0 }}>
                      <span style={{
                        width: 13, height: 13, borderRadius: '50%', background: hex,
                        boxShadow: isHuman ? `0 0 12px ${hex}` : 'none',
                        border: colorKey === 'WHITE' ? '1px solid rgba(0,0,0,0.3)' : 'none',
                      }} />
                      <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-dim)' }}>
                        {label}
                      </span>
                    </div>

                    {/* Human player row */}
                    {isHuman ? (
                      <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 9,
                        padding: '11px 14px', borderRadius: 11,
                        background: 'rgba(228,75,67,0.10)', border: '1px solid rgba(228,75,67,0.35)',
                        color: 'var(--text)', fontWeight: 700, fontSize: 14.5,
                      }}>
                        <Icon name="user" size={17} color="var(--p-red)" />
                        You
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--p-red)', opacity: 0.8 }}>
                          HUMAN
                        </span>
                      </div>
                    ) : (
                      <BotSelect
                        value={slots[i]?.agentId || ''}
                        options={agentOptions}
                        onChange={(id) => setSlots(prev => prev.map((s, idx) => idx === i ? { agentId: id } : s))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Options row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <span
                onClick={() => setFriendlyRobber(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                  background: friendlyRobber ? 'var(--sapphire)' : 'var(--bg-1)',
                  border: `1.5px solid ${friendlyRobber ? 'var(--sapphire-bright)' : 'var(--glass-brd)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  boxShadow: friendlyRobber ? '0 0 8px var(--sapphire-glow)' : 'none',
                }}
              >
                {friendlyRobber && (
                  <svg width="10" height="8" viewBox="0 0 10 8">
                    <polyline points="1,4 4,7 9,1" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>
                Friendly Robber
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>Map Seed</span>
              <input
                type="number"
                value={mapSeed}
                onChange={e => setMapSeed(e.target.value)}
                placeholder="random"
                style={{
                  width: 92, background: 'var(--bg-1)', border: '1px solid var(--glass-brd)',
                  borderRadius: 8, padding: '6px 10px', fontSize: 12.5,
                  color: 'var(--text)', outline: 'none', fontFamily: 'var(--ff-ui)',
                }}
              />
            </div>
          </div>

          {/* Error */}
          {createError && (
            <div style={{
              marginTop: 16, fontSize: 12.5, color: '#f87171',
              background: 'rgba(220,50,50,0.07)', border: '1px solid rgba(220,50,50,0.18)',
              borderRadius: 10, padding: '11px 14px',
            }}>
              {createError}
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStartGame}
            disabled={creating || agentsLoading}
            className="btn btn-primary"
            style={{
              width: '100%', marginTop: 24, padding: '16px 0', fontSize: 17,
              fontFamily: 'var(--ff-display)', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {creating ? (
              <>
                <span style={{
                  width: 17, height: 17, flexShrink: 0,
                  border: '2px solid rgba(255,255,255,0.25)', borderTop: '2px solid #fff',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
                Creating…
              </>
            ) : (
              <>
                <Icon name="play" size={18} color="#fff" />
                Start Game
              </>
            )}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-ghost)', fontWeight: 600, letterSpacing: '0.04em' }}>
          Powered by Hexbandit&nbsp;API · staging-api.hexbandit.io
        </div>
      </motion.div>
    </div>
  );
}
