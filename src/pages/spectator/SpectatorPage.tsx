// Route: /spectate/:gameId — read-only live view that polls the API and populates
// gameStore in spectator mode (no human players, board fully disabled).
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { getGameState, getRecording } from '@/services/api/gamesApi';
import { formatActionLogEvent } from '@/shared/utils/actionLog';
import GameBoard3D from '@/features/game-board/GameBoard3D';
import PlayerPanel from '@/features/player-panel/PlayerPanel';
import EvalBar from '@/features/eval-bar/EvalBar';
import GameLog from '@/features/game-log/GameLog';
import { GameOverScreen } from '@/features/game-over/GameOverScreen';
import { Icon } from '@/shared/components/Icon';
import type { PlayableAction } from '@/shared/types/game';

const POLL_INTERVAL_MS = 2500;
const SIDEBAR_W = 320;
const GAP = 14;

const noopAction = (_: PlayableAction) => {};

export default function SpectatorPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const setGameId          = useGameStore(s => s.setGameId);
  const setHumanPlayers    = useGameStore(s => s.setHumanPlayers);
  const setPerspectiveColor = useGameStore(s => s.setPerspectiveColor);
  const setGameState       = useGameStore(s => s.setGameState);
  const reset              = useGameStore(s => s.reset);
  const gameState          = useGameStore(s => s.gameState);

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayMode, setReplayMode] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!gameId) return;
    reset();
    setGameId(gameId);
    setHumanPlayers([]);
    setPerspectiveColor(null);
    activeRef.current = true;

    async function poll() {
      if (!activeRef.current) return;
      try {
        const s = useGameStore.getState();
        const rawState = await getGameState(gameId!, { actionLogStart: s.actionLogTotal });
        setGameState(rawState);
        setLoading(false);
        setError(null);

        const actionLog = rawState.action_log ?? [];
        const serverTotal = rawState.action_log_total ?? actionLog.length;
        const newCount = serverTotal - s.actionLogTotal;
        if (newCount > 0) {
          const startIdx = Math.max(0, actionLog.length - newCount);
          const fresh = useGameStore.getState();
          for (let i = startIdx; i < actionLog.length; i++) {
            const event = actionLog[i];
            const html = formatActionLogEvent(event, rawState.players);
            if (html !== null) {
              fresh.addLog(`${event.color}|${html}`, 'action', true);
            }
          }
          fresh.setActionLogTotal(serverTotal);
        }

        if (!rawState.winner && activeRef.current) {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Could not load game: ${msg}`);
        setLoading(false);
        if (activeRef.current) {
          pollRef.current = setTimeout(poll, 5000);
        }
      }
    }

    poll();
    return () => {
      activeRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [gameId, reset, setGameId, setHumanPlayers, setPerspectiveColor, setGameState]);

  async function handleEnterReplay() {
    if (!gameId) return;
    setReplayLoading(true);
    try {
      const recording = await getRecording(gameId);
      if (!recording.frames?.length) {
        setError('No replay recording available for this game.');
        return;
      }
      useGameStore.getState().setReplayFrames(recording.frames);
      useGameStore.getState().setReplayStep(0);
      setReplayMode(true);
      if (recording.frames[0]?.state) setGameState(recording.frames[0].state);
    } catch {
      setError('Could not load replay. The game may not have recording enabled.');
    } finally {
      setReplayLoading(false);
    }
  }

  if (error && !gameState) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--bg-1)', fontFamily: 'var(--ff-ui)',
      }}>
        <Icon name="close" size={32} color="var(--p-red)" />
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 340 }}>
          {error}
        </p>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700 }}>
          Go Home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-1)', flexDirection: 'column', gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, border: '3px solid var(--glass-brd2)',
          borderTop: '3px solid var(--sapphire-bright)', borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', fontFamily: 'var(--ff-ui)' }}>
          Loading game…
        </span>
      </div>
    );
  }

  const isLive   = !gameState?.winner;
  const camOffset = SIDEBAR_W + GAP;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: 'var(--ff-ui)' }}>

      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        <GameBoard3D onAction={noopAction} disabled sidebarWidth={camOffset} />
      </div>

      <div className="panel" style={{
        position: 'absolute', top: GAP, left: GAP, right: camOffset + GAP, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Logo */}
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb"/>
          <circle cx="8" cy="8" r="1.5" fill="#0e2244"/>
          <circle cx="16" cy="16" r="1.5" fill="#0e2244"/>
          <circle cx="12" cy="12" r="1.5" fill="var(--p-red)"/>
        </svg>
        <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 16, letterSpacing: '0.05em', color: 'var(--text)' }}>
          HEXBANDIT
        </span>

        <span style={{ width: 1, height: 20, background: 'var(--hairline)', flexShrink: 0 }} />

        {/* Spectating badge */}
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 6,
          background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(125,165,225,0.12)',
          border: `1px solid ${isLive ? 'rgba(239,68,68,0.4)' : 'rgba(125,165,225,0.25)'}`,
          color: isLive ? '#f87171' : 'var(--sapphire-bright)',
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        }}>
          {isLive && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#f87171',
              animation: 'thinking-pulse 1.5s ease-in-out infinite', flexShrink: 0,
            }} />
          )}
          {isLive ? 'Live' : 'Ended'}
        </span>

        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', flexShrink: 0 }}>
          Spectating
        </span>

        {gameState && (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>·</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-faint)' }}>
              Turn {gameState.num_turns}
            </span>
          </>
        )}

        {/* Eval bar fills remaining space */}
        <span style={{ width: 1, height: 20, background: 'var(--hairline)', flexShrink: 0 }} />
        <EvalBar compact />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          {replayMode && (
            <button
              onClick={() => { setReplayMode(false); if (gameState) setGameState(gameState); }}
              className="btn"
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}
            >
              ✕ Exit Replay
            </button>
          )}
          <button onClick={() => navigate('/')} className="btn" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            Home
          </button>
        </div>
      </div>

      <div className="panel" style={{
        position: 'absolute', top: GAP, right: GAP, bottom: GAP, width: SIDEBAR_W, zIndex: 10,
        display: 'flex', flexDirection: 'column', padding: 16, gap: 14, overflow: 'hidden',
      }}>
        <div style={{ flexShrink: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Players</div>
          <PlayerPanel />
        </div>
        <div style={{ height: 1, background: 'var(--hairline)', flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <GameLog />
        </div>
      </div>

      <AnimatePresence>
        {gameState?.winner && !replayMode && (
          <GameOverScreen
            gameState={gameState}
            humanPlayerIndices={[]}
            onPlayAgain={() => navigate('/')}
            onMenu={() => navigate('/')}
            onReplay={handleEnterReplay}
            replayLoading={replayLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
