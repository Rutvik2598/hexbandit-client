import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '@/store/gameStore';
import { useUiStore } from '@/store/uiStore';
import { useGameLoop } from '@/shared/hooks/useGameLoop';
import GameBoard3D from '@/features/game-board/GameBoard3D';
import PlayerPanel from '@/features/player-panel/PlayerPanel';
import EvalBar from '@/features/eval-bar/EvalBar';
import ActionPanel from '@/features/action-panel/ActionPanel';
import GameLog from '@/features/game-log/GameLog';
import AnalysisPanel from '@/features/analysis-panel/AnalysisPanel';
import ReplayControls from '@/features/replay-controls/ReplayControls';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayableAction, PlayerColor } from '@/shared/types/game';

export default function GamePage() {
  const navigate = useNavigate();
  const gameId = useGameStore(s => s.gameId);
  const gameState = useGameStore(s => s.gameState);
  const humanPlayerIndices = useGameStore(s => s.humanPlayerIndices);
  const autoPlaying = useGameStore(s => s.autoPlaying);
  const thinking = useGameStore(s => s.thinking);
  const replayMode = useGameStore(s => s.replayMode);
  const lastRollDice = useGameStore(s => s.lastRollDice);
  const setHumanPlayers = useGameStore(s => s.setHumanPlayers);
  const setPerspectiveColor = useGameStore(s => s.setPerspectiveColor);
  const reset = useGameStore(s => s.reset);

  const sidebarTab = useUiStore(s => s.sidebarTab);
  const setSidebarTab = useUiStore(s => s.setSidebarTab);

  const {
    refreshState,
    evaluatePosition,
    doAiMove,
    submitAction,
    autoAdvanceAI,
    startAutoPlay,
    stopAutoPlay,
    isCurrentPlayerHuman,
    enterReplay,
    exitReplay,
    cleanup,
  } = useGameLoop();

  const initialized = useRef(false);

  // Redirect if no game
  useEffect(() => {
    if (!gameId) {
      navigate('/');
    }
  }, [gameId, navigate]);

  // Initialize: load state then start AI if needed
  useEffect(() => {
    if (!gameId || initialized.current) return;
    initialized.current = true;

    refreshState().then(ok => {
      if (!ok) return;
      const state = useGameStore.getState().gameState;
      if (!state) return;

      // Resolve human player indices from the server's game state.
      // The server decides actual player order — never assume index 0 is human.
      const humanIndices = state.players
        .map((p, i) => (p.agent_id === 'human' ? i : -1))
        .filter(i => i >= 0);
      setHumanPlayers(humanIndices);

      if (humanIndices.length > 0) {
        const humanColor = state.players[humanIndices[0]].color;
        setPerspectiveColor(humanColor);
      }

      // Now decide what to do first
      const isHuman = humanIndices.includes(state.current_player_index);
      if (humanIndices.length === 0) {
        startAutoPlay();
      } else if (isHuman) {
        evaluatePosition();
      } else {
        autoAdvanceAI();
      }
    });
  }, [gameId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't delete game on unmount in case user navigates back
    };
  }, []);

  const handleAction = useCallback(async (action: PlayableAction) => {
    await submitAction(action);
  }, [submitAction]);

  const handleNewGame = useCallback(async () => {
    stopAutoPlay();
    await cleanup();
    reset();
    initialized.current = false;
    navigate('/');
  }, [stopAutoPlay, cleanup, reset, navigate]);

  const isHumanTurn = isCurrentPlayerHuman();
  const isDisabled = !isHumanTurn || replayMode || thinking.phase === 'thinking' || thinking.phase === 'submitting';

  const currentPlayer = gameState?.players[gameState.current_player_index];
  const currentColor = currentPlayer?.color as PlayerColor | undefined;

  if (!gameId) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-slate-900/90 border-b border-slate-800/60 backdrop-blur-sm z-10">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg">🎲</span>
          <span className="font-bold text-white text-sm hidden sm:block">Hexbandit</span>
        </div>

        <div className="w-px h-5 bg-slate-700 hidden sm:block" />

        {/* Game info */}
        {gameState && (
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-shrink-0">
            <span>Turn {gameState.num_turns}</span>
            <span className="text-slate-600">·</span>
            <span
              className="font-semibold"
              style={{ color: currentColor ? PLAYER_COLORS[currentColor] : '#94a3b8' }}
            >
              {currentColor}'s turn
            </span>
            <span className="text-slate-600 hidden md:block">·</span>
            <span className="hidden md:block">{formatPhase(gameState.game_phase)}</span>
          </div>
        )}

        {/* Dice display */}
        {lastRollDice && (
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-white text-slate-900 font-bold text-xs shadow">
              {lastRollDice[0]}
            </span>
            <span className="text-slate-500 text-xs">+</span>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-white text-slate-900 font-bold text-xs shadow">
              {lastRollDice[1]}
            </span>
            <span className="text-slate-400 text-xs font-semibold ml-0.5">={lastRollDice[0] + lastRollDice[1]}</span>
          </div>
        )}

        {/* Eval bar — compact in header */}
        <div className="flex-1 hidden lg:block max-w-xs">
          <EvalBar compact />
        </div>

        {/* Thinking badge */}
        <AnimatePresence>
          {(thinking.phase === 'thinking' || thinking.phase === 'submitting') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 bg-slate-800 border border-slate-600/50 rounded-full px-3 py-1"
            >
              <span className="thinking-pulse text-sm">🧠</span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">{thinking.message}</span>
                  <span className="text-xs text-slate-500">{Math.round(thinking.progress)}%</span>
                </div>
                <div className="h-0.5 w-24 bg-slate-700 rounded-full">
                  <motion.div
                    className="h-full bg-blue-400 rounded-full"
                    animate={{ width: `${thinking.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-2">
          {/* Auto-play toggle */}
          {humanPlayerIndices.length === 0 && !replayMode && (
            <button
              onClick={autoPlaying ? stopAutoPlay : startAutoPlay}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                autoPlaying
                  ? 'bg-amber-700/50 border-amber-600/50 text-amber-300'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700',
              )}
            >
              {autoPlaying ? '⏸ Stop' : '⏵ Auto'}
            </button>
          )}

          {/* Manual AI move for non-auto games */}
          {!isHumanTurn && !autoPlaying && !replayMode && !gameState?.winner && (
            <button
              onClick={doAiMove}
              disabled={thinking.phase !== 'idle'}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40"
            >
              🤖 AI Move
            </button>
          )}

          {/* Replay button */}
          {gameState?.winner && !replayMode && (
            <button
              onClick={enterReplay}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-600/50 bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 transition-all"
            >
              📼 Replay
            </button>
          )}

          {replayMode && (
            <button
              onClick={exitReplay}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
            >
              ✕ Exit Replay
            </button>
          )}

          {/* New game */}
          <button
            onClick={handleNewGame}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
          >
            New Game
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Board area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Board */}
          <div className="flex-1 min-h-0 relative">
            {!gameState ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin mx-auto" />
                  <div className="text-sm">Loading game…</div>
                </div>
              </div>
            ) : (
              <GameBoard3D onAction={handleAction} disabled={isDisabled} />
            )}

            {/* Winner overlay */}
            <AnimatePresence>
              {gameState?.winner && !replayMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="text-center bg-slate-900/95 border border-slate-700 rounded-2xl px-8 py-6 shadow-2xl"
                  >
                    <div className="text-5xl mb-3">🏆</div>
                    <div
                      className="text-2xl font-bold mb-1"
                      style={{ color: PLAYER_COLORS[gameState.winner as PlayerColor] || '#fff' }}
                    >
                      {gameState.winner} Wins!
                    </div>
                    <p className="text-slate-400 text-sm mb-4">Game over</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={enterReplay}
                        className="px-4 py-2 rounded-xl text-sm bg-purple-700 hover:bg-purple-600 text-white font-medium transition-all"
                      >
                        📼 Watch Replay
                      </button>
                      <button
                        onClick={handleNewGame}
                        className="px-4 py-2 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
                      >
                        New Game
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom: eval bar (on small screens) + action panel */}
          <div className="flex-shrink-0 border-t border-slate-800/60 bg-slate-900/70 backdrop-blur-sm">
            {/* Eval bar */}
            <div className="lg:hidden border-b border-slate-800/40 px-3 py-1">
              <EvalBar compact />
            </div>

            {/* Actions */}
            {!replayMode ? (
              <ActionPanel onAction={handleAction} disabled={isDisabled} />
            ) : (
              <div className="p-3">
                <ReplayControls />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex-shrink-0 w-72 xl:w-80 flex flex-col border-l border-slate-800/60 bg-slate-900/50 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="flex-shrink-0 flex border-b border-slate-800/60">
            {(['players', 'log', 'analysis'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={clsx(
                  'flex-1 py-2 text-xs font-medium capitalize transition-all border-b-2',
                  sidebarTab === tab
                    ? 'border-blue-500 text-blue-400 bg-slate-800/30'
                    : 'border-transparent text-slate-500 hover:text-slate-400',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {sidebarTab === 'players' && (
              <div className="p-3">
                <PlayerPanel />
              </div>
            )}
            {sidebarTab === 'log' && (
              <div className="h-full">
                <GameLog />
              </div>
            )}
            {sidebarTab === 'analysis' && (
              <div className="p-3">
                <AnalysisPanel />
                {!replayMode && (
                  <div className="text-xs text-slate-600 text-center mt-4">
                    Analysis available in replay mode
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    INITIAL_BUILD: 'Setup',
    PLAY_TURN: 'Playing',
    DISCARDING: 'Discarding',
    MOVING_ROBBER: 'Moving Robber',
    ROAD_BUILDING: 'Road Building',
    RESOLVING_TRADE: 'Trade',
    DECIDE_ACCEPTEES: 'Confirm Trade',
  };
  return labels[phase] || phase;
}
