import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
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
import { ResourceHand } from '@/features/resource-hand/ResourceHand';
import { BankPanel } from '@/features/bank/BankPanel';
import { TradeModal } from '@/features/trade/TradeModal';
import { OfferTradeModal } from '@/features/trade/OfferTradeModal';
import { FlyLayer, flyResource } from '@/shared/components/FlyLayer';
import { PLAYER_COLORS, RESOURCE_ORDER } from '@/shared/constants';
import { GameOverScreen } from '@/features/game-over/GameOverScreen';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { PlayableAction, PlayerColor, DevCardType, ResourceCounts } from '@/shared/types/game';

export default function GamePage() {
  const navigate = useNavigate();
  const gameId             = useGameStore(s => s.gameId);
  const gameState          = useGameStore(s => s.gameState);
  const humanPlayerIndices = useGameStore(s => s.humanPlayerIndices);
  const autoPlaying        = useGameStore(s => s.autoPlaying);
  const thinking           = useGameStore(s => s.thinking);
  const replayMode         = useGameStore(s => s.replayMode);
  const resourceGains      = useGameStore(s => s.resourceGains);
  const perspectiveColor   = useGameStore(s => s.perspectiveColor);
  const setHumanPlayers    = useGameStore(s => s.setHumanPlayers);
  const setPerspectiveColor = useGameStore(s => s.setPerspectiveColor);
  const reset              = useGameStore(s => s.reset);

  const sidebarTab      = useUiStore(s => s.sidebarTab);
  const setSidebarTab   = useUiStore(s => s.setSidebarTab);
  const showTradeModal       = useUiStore(s => s.showTradeModal);
  const setShowTradeModal    = useUiStore(s => s.setShowTradeModal);
  const showOfferTradeModal  = useUiStore(s => s.showOfferTradeModal);
  const setShowOfferTradeModal = useUiStore(s => s.setShowOfferTradeModal);

  const {
    refreshState, evaluatePosition,
    submitAction, autoAdvanceAI, startAutoPlay, stopAutoPlay,
    isCurrentPlayerHuman, enterReplay, exitReplay, cleanup,
  } = useGameLoop();

  const [replayLoading, setReplayLoading] = useState(false);

  const handleEnterReplay = useCallback(async () => {
    setReplayLoading(true);
    try {
      await enterReplay();
      setSidebarTab('analysis');
    } finally {
      setReplayLoading(false);
    }
  }, [enterReplay, setSidebarTab]);

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const initialized = useRef(false);
  const prevGains   = useRef(resourceGains);

  // ---- redirect if no game ------------------------------------------------
  useEffect(() => {
    if (!gameId) navigate('/');
  }, [gameId, navigate]);

  // ---- initialise game on mount -------------------------------------------
  useEffect(() => {
    if (!gameId || initialized.current) return;
    initialized.current = true;

    refreshState().then(ok => {
      if (!ok) return;
      const state = useGameStore.getState().gameState;
      if (!state) return;

      const humanIndices = state.players
        .map((p, i) => (p.agent_id === 'human' ? i : -1))
        .filter(i => i >= 0);
      setHumanPlayers(humanIndices);

      if (humanIndices.length > 0) {
        setPerspectiveColor(state.players[humanIndices[0]].color);
      }

      const isHuman = humanIndices.includes(state.current_player_index);
      if (humanIndices.length === 0) {
        startAutoPlay();
      } else if (isHuman) {
        evaluatePosition();
      } else {
        autoAdvanceAI();
      }
    });
  }, [gameId]); // eslint-disable-line

  // ---- fly animations when resource gains arrive --------------------------
  useEffect(() => {
    if (!resourceGains || resourceGains === prevGains.current) return;
    prevGains.current = resourceGains;

    // Fly cards only when the human player gains resources (whoever rolled).
    // resourceGains is keyed by player COLOR — match against the human's color.
    const humanColors = new Set<string>(
      humanPlayerIndices
        .map(idx => useGameStore.getState().gameState?.players[idx]?.color as string | undefined)
        .filter((c): c is string => !!c)
    );
    Object.entries(resourceGains).forEach(([color, gains]) => {
      if (!gains || !humanColors.has(color)) return;
      (Object.entries(gains) as [string, number][]).forEach(([res, count], i) => {
        if (count <= 0) return;
        setTimeout(() => flyResource(res, 'gain', Math.min(count, 6)), i * 60);
      });
    });
  }, [resourceGains, humanPlayerIndices]);

  // ---- derived -------------------------------------------------------
  const isHumanTurn = isCurrentPlayerHuman();
  const isDisabled  = !isHumanTurn || replayMode ||
    thinking.phase === 'thinking' || thinking.phase === 'submitting';

  const currentPlayer  = gameState?.players[gameState.current_player_index];
  const currentColor   = currentPlayer?.color as PlayerColor | undefined;

  // Human player's data for the hand display
  const humanPlayer = humanPlayerIndices.length > 0
    ? gameState?.players[humanPlayerIndices[0]]
    : null;

  // Resources to highlight when hovering a build button
  // (ActionPanel passes buildCost via internal state; ResourceHand just shows counts for now)

  // Bank resources
  const bankResources = (gameState?.bank_resources ?? {}) as ResourceCounts;

  // Maritime trade actions available to human
  const maritimeActions = useMemo(() =>
    (gameState?.playable_actions ?? []).filter(a => a.action_type === 'MARITIME_TRADE'),
    [gameState?.playable_actions]);

  const canTrade = maritimeActions.length > 0 && isHumanTurn && !isDisabled;

  // Dev card play handler (dispatched from ResourceHand dev stacks)
  const handlePlayDev = useCallback((type: DevCardType) => {
    const actionMap: Record<DevCardType, PlayableAction['action_type'] | null> = {
      knight:         'PLAY_KNIGHT_CARD',
      road_building:  'PLAY_ROAD_BUILDING',
      year_of_plenty: 'PLAY_YEAR_OF_PLENTY',
      monopoly:       'PLAY_MONOPOLY',
      victory_point:  null,
    };
    const actionType = actionMap[type];
    if (actionType) submitAction({ action_type: actionType, value: null });
  }, [submitAction]);

  const handleAction = useCallback(async (action: PlayableAction) => {
    // Intercept sentinel — open offer-trade modal instead of submitting
    if (action.action_type === 'OFFER_TRADE' && action.value === '__open_modal__') {
      setShowOfferTradeModal(true);
      return;
    }
    // Trigger fly-out animation for spend actions
    if (action.action_type === 'MARITIME_TRADE' && Array.isArray(action.value)) {
      const val = action.value as (number | null)[];
      const giving = val.slice(0, -1).filter((v): v is number => v !== null);
      if (giving.length > 0) {
        const res = RESOURCE_ORDER[giving[0]];
        if (res) flyResource(res, 'spend', giving.length);
      }
    }
    await submitAction(action);
  }, [submitAction, setShowOfferTradeModal]);

  const confirmNewGame = useCallback(async () => {
    setShowExitConfirm(false);
    stopAutoPlay();
    await cleanup();
    reset();
    initialized.current = false;
    navigate('/');
  }, [stopAutoPlay, cleanup, reset, navigate]);

  const handleNewGame = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  // Warn on accidental refresh / tab close while a game is running
  useEffect(() => {
    if (!gameId) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [gameId]);

  if (!gameId) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: 'var(--ff-ui)' }}>
      {/* Flying cards layer — must be above everything */}
      <FlyLayer />

      {/* Atmospheric tint — sits above the canvas water */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 120% 80% at 50% 0%, rgba(16,36,64,0.45) 0%, transparent 60%)',
      }} />

      {/* Edge vignette over board */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(6,11,21,0.5) 100%), linear-gradient(180deg, rgba(6,11,21,0.55) 0%, transparent 16%, transparent 68%, rgba(6,11,21,0.65) 100%)',
      }} />

      {/* ---- top bar ---------------------------------------------------- */}
      <div className="panel" style={{
        position: 'absolute', top: 14, left: 14, right: 372, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        borderRadius: 14,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb"/>
            <circle cx="8" cy="8" r="1.5" fill="#0e2244"/>
            <circle cx="16" cy="16" r="1.5" fill="#0e2244"/>
            <circle cx="12" cy="12" r="1.5" fill="var(--p-red)"/>
          </svg>
          <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 17, letterSpacing: '0.05em', color: 'var(--text)' }}>
            HEXBANDIT
          </span>
        </div>

        <span style={{ width: 1, height: 20, background: 'var(--hairline)', flexShrink: 0 }} />

        {/* Turn / phase */}
        {gameState && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)' }}>
              Turn <span style={{ color: 'var(--text)' }}>{gameState.num_turns}</span>
            </span>
            {currentColor && (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: PLAYER_COLORS[currentColor] }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLAYER_COLORS[currentColor], boxShadow: `0 0 8px ${PLAYER_COLORS[currentColor]}` }} />
                  {currentColor}'s turn
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-ghost)', display: 'none' }} className="md:inline">·</span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)', display: 'none' }} className="md:inline">
                  {formatPhase(gameState.game_phase)}
                </span>
              </>
            )}
          </div>
        )}

        <span style={{ width: 1, height: 20, background: 'var(--hairline)', flexShrink: 0 }} />

        {/* Win probability bar */}
        <EvalBar compact />


        {/* Right controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          {humanPlayerIndices.length === 0 && !replayMode && (
            <button
              onClick={autoPlaying ? stopAutoPlay : startAutoPlay}
              className="btn"
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700 }}
            >
              {autoPlaying ? '⏸ Stop' : '⏵ Auto'}
            </button>
          )}


          {gameState?.winner && !replayMode && (
            <button
              onClick={handleEnterReplay}
              disabled={replayLoading}
              className="btn"
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, borderColor: 'rgba(160,130,235,0.4)', color: '#c4b5f5', display: 'flex', alignItems: 'center', gap: 7, opacity: replayLoading ? 0.7 : 1 }}
            >
              {replayLoading ? (
                <>
                  <span className="thinking-pulse" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #c4b5f5', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Loading…
                </>
              ) : '📼 Replay'}
            </button>
          )}

          {replayMode && (
            <button onClick={exitReplay} className="btn" style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700 }}>
              ✕ Exit Replay
            </button>
          )}

<button onClick={handleNewGame} className="btn" style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700 }}>
            New Game
          </button>
        </div>
      </div>

      {/* ---- board — full-screen canvas, camera offset keeps board in left zone */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        {!gameState ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, border: '2.5px solid var(--glass-brd2)', borderTop: '2.5px solid var(--sapphire-bright)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Loading game…</div>
            </div>
          </div>
        ) : (
          <GameBoard3D onAction={handleAction} disabled={isDisabled} />
        )}
      </div>

      {/* ---- bottom-left command zone ------------------------------------ */}
      {gameState && (
        <div style={{
          position: 'absolute', left: 14, bottom: 20, zIndex: 12,
          display: 'flex', alignItems: 'flex-end', gap: 20,
          pointerEvents: 'none',
        }}>
          {/* Left: action panel (dice + build) */}
          {!replayMode ? (
            <ActionPanel onAction={handleAction} disabled={isDisabled} />
          ) : (
            <div className="panel" style={{ padding: 12, pointerEvents: 'auto' }}>
              <ReplayControls />
            </div>
          )}

          {/* Centre: resource hand + dev stacks (human player only) */}
          {humanPlayer && !replayMode && (
            <div style={{ pointerEvents: 'auto' }}>
              <ResourceHand
                resources={humanPlayer.resources}
                devCards={humanPlayer.dev_cards_private}
                isMyTurn={isHumanTurn && !isDisabled}
                onPlayDev={handlePlayDev}
              />
            </div>
          )}
        </div>
      )}

      {/* ---- right sidebar ----------------------------------------------- */}
      <div className="panel" style={{
        position: 'absolute', top: 14, right: 14, bottom: 14, width: 344, zIndex: 10,
        display: 'flex', flexDirection: 'column', padding: 16, gap: 14,
        overflow: 'hidden',
      }}>
        {/* Tab bar */}
        <div style={{
          flexShrink: 0, display: 'flex', borderRadius: 10, overflow: 'hidden',
          background: 'var(--bg-1)', border: '1px solid var(--hairline)',
        }}>
          {(['players', 'analysis'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: sidebarTab === tab ? 'var(--glass-hi)' : 'transparent',
                color: sidebarTab === tab ? 'var(--text)' : 'var(--text-faint)',
                border: 'none', borderBottom: `2px solid ${sidebarTab === tab ? 'var(--sapphire-bright)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sidebarTab === 'players' && (
            <>
              <PlayerPanel />
              <div style={{ height: 1, background: 'var(--hairline)', flexShrink: 0 }} />
              <GameLog />
              <div style={{ height: 1, background: 'var(--hairline)', flexShrink: 0 }} />
              <BankPanel
                bank={bankResources}
                canTrade={canTrade}
                onTrade={() => setShowTradeModal(true)}
              />
            </>
          )}

          {sidebarTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnalysisPanel />
              {!replayMode && (
                <div style={{ fontSize: 11.5, color: 'var(--text-ghost)', textAlign: 'center' }}>
                  Full analysis available in replay mode
                </div>
              )}
            </div>
          )}
        </div>

        {/* Perspective indicator at bottom */}
        {perspectiveColor && (
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 2px 0', borderTop: '1px solid var(--hairline)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: PLAYER_COLORS[perspectiveColor as PlayerColor] || '#ccc',
              boxShadow: `0 0 8px ${PLAYER_COLORS[perspectiveColor as PlayerColor] || '#ccc'}`,
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)' }}>
              Playing as {perspectiveColor}
            </span>
          </div>
        )}
      </div>

      {/* ---- winner overlay ---------------------------------------------- */}
      <AnimatePresence>
        {gameState?.winner && !replayMode && (
          <GameOverScreen
            gameState={gameState}
            humanPlayerIndices={humanPlayerIndices}
            onPlayAgain={handleNewGame}
            onMenu={handleNewGame}
            onReplay={handleEnterReplay}
            replayLoading={replayLoading}
          />
        )}
      </AnimatePresence>

      {/* ---- maritime trade modal --------------------------------------- */}
      {showTradeModal && gameState && (
        <TradeModal
          hand={humanPlayer?.resources ?? {} as ResourceCounts}
          bank={bankResources}
          maritimeActions={maritimeActions}
          onConfirm={handleAction}
          onClose={() => setShowTradeModal(false)}
        />
      )}

      {/* ---- offer trade modal ------------------------------------------ */}
      {showOfferTradeModal && gameState && humanPlayer && (
        <OfferTradeModal
          hand={humanPlayer.resources}
          players={gameState.players.map((p, i) => ({ name: p.name, color: p.color, index: i }))}
          onConfirm={handleAction}
          onClose={() => setShowOfferTradeModal(false)}
        />
      )}

      {/* ---- exit confirmation ------------------------------------------- */}
      <ConfirmModal
        open={showExitConfirm}
        title="Leave Game?"
        message="Your current game will be lost. Are you sure you want to exit?"
        confirmLabel="Leave"
        cancelLabel="Keep Playing"
        danger
        onConfirm={confirmNewGame}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    INITIAL_BUILD:   'Setup',
    PLAY_TURN:       'Playing',
    DISCARDING:      'Discarding',
    MOVING_ROBBER:   'Moving Robber',
    ROAD_BUILDING:   'Road Building',
    RESOLVING_TRADE: 'Trade',
    DECIDE_ACCEPTEES: 'Confirm Trade',
  };
  return labels[phase] || phase;
}
