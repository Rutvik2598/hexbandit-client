import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useUiStore } from '@/store/uiStore';
import { useGameLoop } from '@/shared/hooks/useGameLoop';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useInteractionStore } from '@/store/interactionStore';
import GameBoard3D from '@/features/game-board/GameBoard3D';
import { Icon } from '@/shared/components/Icon';
import { DiceTray } from '@/features/dice/DiceTray';
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
import { ResourceIcon } from '@/shared/components/ResourceIcon';
import { PLAYER_COLORS, RESOURCE_ORDER } from '@/shared/constants';
import { GameOverScreen } from '@/features/game-over/GameOverScreen';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { PlacementHint } from '@/features/game-board/PlacementHint';
import { useSoundEffects } from '@/shared/hooks/useSoundEffects';
import { playSound, SFX } from '@/shared/hooks/useSound';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { addToast } from '@/store/toastStore';
import { AnnouncementBanner } from '@/shared/components/AnnouncementBanner';
import type { AchievementData } from '@/shared/components/AnnouncementBanner';
import type { PlayableAction, Player, PlayerColor, DevCardType, ResourceCounts, ResourceType } from '@/shared/types/game';

type MobileDrawerTab = 'action' | 'players' | 'trade' | null;

// ── Layout config per breakpoint ──────────────────────────────────────────────
// Desktop: 14px margins, 344px sidebar, 372px camera offset
// Tablet:  10px margins, 260px sidebar, 280px camera offset
const LAYOUT = {
  desktop: { gap: 14, panelW: 344, camOffset: 372, bottomOffset: 20 },
  tablet:  { gap: 10, panelW: 260, camOffset: 280, bottomOffset: 14 },
  mobile:  { gap: 8,  panelW: 0,   camOffset: 0,   bottomOffset: 0  },
} as const;

export default function GamePage() {
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const layout = LAYOUT[bp];

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
  const lastRollDice       = useGameStore(s => s.lastRollDice);
  const logEntries         = useGameStore(s => s.logEntries);

  const mode    = useInteractionStore(s => s.mode);
  const setMode = useInteractionStore(s => s.setMode);

  const sidebarTab      = useUiStore(s => s.sidebarTab);
  const setSidebarTab   = useUiStore(s => s.setSidebarTab);
  const showTradeModal       = useUiStore(s => s.showTradeModal);
  const setShowTradeModal    = useUiStore(s => s.setShowTradeModal);
  const showOfferTradeModal  = useUiStore(s => s.showOfferTradeModal);
  const setShowOfferTradeModal = useUiStore(s => s.setShowOfferTradeModal);
  const muted           = useUiStore(s => s.muted);
  const toggleMuted     = useUiStore(s => s.toggleMuted);
  const showSettings    = useUiStore(s => s.showSettings);
  const setShowSettings = useUiStore(s => s.setShowSettings);

  const {
    refreshState, evaluatePosition,
    submitAction, autoAdvanceAI, startAutoPlay, stopAutoPlay,
    isCurrentPlayerHuman, enterReplay, exitReplay, cleanup,
  } = useGameLoop();

  const [replayLoading, setReplayLoading] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [achievement, setAchievement] = useState<AchievementData | null>(null);
  const [showYourTurn, setShowYourTurn] = useState(false);
  const [showYopPicker, setShowYopPicker] = useState(false);
  const [yopFirstPick, setYopFirstPick] = useState<ResourceType | null>(null);
  const [showMonoPicker, setShowMonoPicker] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawerTab>(null);
  const [rollKeyCompact, setRollKeyCompact]         = useState(0);
  const [rollPendingCompact, setRollPendingCompact] = useState(false);

  useSoundEffects();

  const initialized        = useRef(false);
  const prevGains          = useRef(resourceGains);
  const prevDiceRef        = useRef<typeof lastRollDice>(lastRollDice);
  const prevNeedsSpecial   = useRef(false);
  const prevPlayersRef     = useRef<Player[] | null>(null);
  const prevHumanTurnRef   = useRef<boolean | null>(null);

  // ── Derived game state ─────────────────────────────────────────────────────
  const playableActions = gameState?.playable_actions ?? [];
  const hasRoll         = playableActions.some(a => a.action_type === 'ROLL');
  const hasEndTurn      = playableActions.some(a => a.action_type === 'END_TURN');
  const hasDiscard      = gameState?.game_phase === 'DISCARDING';
  const hasTradeResponse = playableActions.some(a =>
    a.action_type === 'ACCEPT_TRADE' || a.action_type === 'REJECT_TRADE' || a.action_type === 'CANCEL_TRADE'
  );
  const isDecideAcceptees = gameState?.game_phase === 'DECIDE_ACCEPTEES';
  const needsSpecialAction   = hasDiscard || hasTradeResponse || isDecideAcceptees;
  const hasBuildSettlement   = playableActions.some(a => a.action_type === 'BUILD_SETTLEMENT');
  const hasBuildCity         = playableActions.some(a => a.action_type === 'BUILD_CITY');
  const hasBuildRoad         = playableActions.some(a => a.action_type === 'BUILD_ROAD');
  const hasBuyDev            = playableActions.some(a => a.action_type === 'BUY_DEVELOPMENT_CARD');

  const compactBuildItems = [
    { key: 'settlement', icon: 'settlement' as const, modeKey: 'BUILD_SETTLEMENT' as const, available: hasBuildSettlement, directAction: null as null },
    { key: 'city',       icon: 'city'       as const, modeKey: 'BUILD_CITY'       as const, available: hasBuildCity,       directAction: null as null },
    { key: 'road',       icon: 'road'       as const, modeKey: 'BUILD_ROAD'       as const, available: hasBuildRoad,       directAction: null as null },
    { key: 'devcard',    icon: 'devcard'    as const, modeKey: null as null,                 available: hasBuyDev,          directAction: 'BUY_DEVELOPMENT_CARD' as const },
  ];

  // ── Redirect if no game ────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) navigate('/');
  }, [gameId, navigate]);

  // ── Init game on mount ─────────────────────────────────────────────────────
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

  // ── Fly animations on resource gains ──────────────────────────────────────
  useEffect(() => {
    if (!resourceGains || resourceGains === prevGains.current) return;
    prevGains.current = resourceGains;

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

  // ── Auto-open / auto-close action drawer for trade responses and discard ──
  // Opens when a special action arrives (trade offer, discard prompt).
  // Closes when the action resolves — no button tap needed.
  // Does NOT reopen if the user manually dismissed the drawer.
  useEffect(() => {
    if (bp !== 'mobile') return;
    const was = prevNeedsSpecial.current;
    prevNeedsSpecial.current = needsSpecialAction;

    if (!was && needsSpecialAction && humanPlayerIndices.length > 0 && !replayMode) {
      setMobileDrawer('action');
    } else if (was && !needsSpecialAction) {
      setMobileDrawer(d => d === 'action' ? null : d);
    }
  }, [bp, needsSpecialAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close mobile drawer when game ends or replay mode changes ─────────────
  useEffect(() => {
    if (bp === 'mobile') setMobileDrawer(null);
  }, [replayMode, bp]);

  useEffect(() => {
    if (gameState?.winner && !replayMode && bp === 'mobile') setMobileDrawer(null);
  }, [gameState?.winner, replayMode, bp]);

  // ── Warn on accidental tab close ──────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [gameId]);

  // ── Largest Army / Longest Road detection ─────────────────────────────────
  useEffect(() => {
    if (!gameState || replayMode) return;
    const players = gameState.players;
    const prev = prevPlayersRef.current;
    prevPlayersRef.current = players;
    if (!prev) return;

    for (const player of players) {
      const prevP = prev.find(p => p.color === player.color);
      if (!prevP) continue;
      if (!prevP.has_largest_army && player.has_largest_army) {
        setAchievement({ type: 'largest_army', playerName: player.name, playerColor: player.color as PlayerColor });
        playSound(SFX.achievement, 0.75);
        return;
      }
      if (!prevP.has_longest_road && player.has_longest_road) {
        setAchievement({ type: 'longest_road', playerName: player.name, playerColor: player.color as PlayerColor });
        playSound(SFX.achievement, 0.75);
        return;
      }
    }
  }, [gameState, replayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(() => setAchievement(null), 4000);
    return () => clearTimeout(t);
  }, [achievement]);

  // ── Your Turn detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || replayMode || humanPlayerIndices.length === 0 || gameState.winner) return;
    const isNowHuman = humanPlayerIndices.includes(gameState.current_player_index);
    if (prevHumanTurnRef.current === false && isNowHuman) {
      setShowYourTurn(true);
      playSound(SFX.yourTurn, 0.7);
    }
    prevHumanTurnRef.current = isNowHuman;
  }, [gameState, replayMode, humanPlayerIndices]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showYourTurn) return;
    const t = setTimeout(() => setShowYourTurn(false), 2500);
    return () => clearTimeout(t);
  }, [showYourTurn]);

  // ── Replay helpers ────────────────────────────────────────────────────────
  const handleEnterReplay = useCallback(async () => {
    setReplayLoading(true);
    try {
      await enterReplay();
      setSidebarTab('analysis');
    } finally {
      setReplayLoading(false);
    }
  }, [enterReplay, setSidebarTab]);

  // ── Common derived values ─────────────────────────────────────────────────
  const isHumanTurn = isCurrentPlayerHuman();
  const isDisabled  = !isHumanTurn || replayMode ||
    thinking.phase === 'thinking' || thinking.phase === 'submitting';
  const isRollingCompact = rollPendingCompact || (!isHumanTurn && hasRoll && thinking.phase !== 'idle');

  const currentPlayer  = gameState?.players[gameState.current_player_index];
  const currentColor   = currentPlayer?.color as PlayerColor | undefined;

  const humanPlayer = humanPlayerIndices.length > 0
    ? gameState?.players[humanPlayerIndices[0]]
    : null;

  // ── Auto-activate BUILD_ROAD during initial placement on all breakpoints ──
  // ActionPanel has the same logic but isn't mounted on mobile when the drawer
  // is closed. Centralising it here ensures consistent behaviour everywhere.
  const isRoadForced = hasBuildRoad && !hasRoll && !hasBuildSettlement && !hasBuildCity && !hasEndTurn && !hasDiscard;
  useEffect(() => {
    if (isRoadForced && !isDisabled) setMode('BUILD_ROAD');
  }, [isRoadForced, isDisabled, setMode]);

  const bankResources = (gameState?.bank_resources ?? {}) as ResourceCounts;

  const devCardsServerAllows = useMemo(() => ({
    knight:         playableActions.some(a => a.action_type === 'PLAY_KNIGHT_CARD'),
    year_of_plenty: playableActions.some(a => a.action_type === 'PLAY_YEAR_OF_PLENTY'),
    monopoly:       playableActions.some(a => a.action_type === 'PLAY_MONOPOLY'),
    road_building:  playableActions.some(a => a.action_type === 'PLAY_ROAD_BUILDING'),
  }), [playableActions]);

  const maritimeActions = useMemo(() =>
    (gameState?.playable_actions ?? []).filter(a => a.action_type === 'MARITIME_TRADE'),
    [gameState?.playable_actions]);

  const canTrade = maritimeActions.length > 0 && isHumanTurn && !isDisabled;
  const isOfferTradeAllowed = !!(gameState?.is_trade_allowed) && isHumanTurn && !isDisabled;

  const maritimeGiveRates = useMemo(() => {
    const rates = new Map<string, number>();
    for (const a of playableActions) {
      if (a.action_type !== 'MARITIME_TRADE' || !Array.isArray(a.value)) continue;
      const val = a.value as (number | null)[];
      const gives = val.slice(0, -1).filter((v): v is number => v !== null);
      if (gives.length === 0) continue;
      const res = RESOURCE_ORDER[gives[0]];
      if (res && !rates.has(res)) rates.set(res, gives.length);
    }
    return rates;
  }, [playableActions]);

  // ── Action handlers ───────────────────────────────────────────────────────
  const handlePlayDev = useCallback((type: DevCardType) => {
    if (type === 'year_of_plenty') { setShowYopPicker(true); return; }
    if (type === 'monopoly')       { setShowMonoPicker(true); return; }
    const actionMap: Record<DevCardType, PlayableAction['action_type'] | null> = {
      knight:         'PLAY_KNIGHT_CARD',
      road_building:  'PLAY_ROAD_BUILDING',
      year_of_plenty: null,
      monopoly:       null,
      victory_point:  null,
    };
    const actionType = actionMap[type];
    if (actionType) submitAction({ action_type: actionType, value: null });
  }, [submitAction]);

  const handleAction = useCallback(async (action: PlayableAction) => {
    if (action.action_type === 'OFFER_TRADE' && action.value === '__open_modal__') {
      setShowOfferTradeModal(true);
      return;
    }
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

  // Wire keyboard shortcuts — must come after handleAction is defined.
  useKeyboardShortcuts({ onAction: handleAction });

  const handleShare = useCallback(() => {
    if (!gameId) return;
    const url = `${window.location.origin}/spectate/${gameId}`;
    navigator.clipboard.writeText(url).then(
      () => addToast('Spectator link copied to clipboard!', 'success'),
      () => addToast(`Share this link: ${url}`, 'info', 8000),
    );
  }, [gameId]);

  // ── Compact dice roll (defined after handleAction to avoid TDZ) ───────────
  const handleCompactRoll = useCallback(() => {
    setRollPendingCompact(true);
    setRollKeyCompact(k => k + 1);
    handleAction({ action_type: 'ROLL', value: null });
  }, [handleAction]);

  useEffect(() => {
    if (!rollPendingCompact) { prevDiceRef.current = lastRollDice; return; }
    if (lastRollDice !== prevDiceRef.current) {
      setRollPendingCompact(false);
      prevDiceRef.current = lastRollDice;
    }
  }, [lastRollDice, rollPendingCompact]);

  const confirmNewGame = useCallback(async () => {
    setShowExitConfirm(false);
    stopAutoPlay();
    await cleanup();
    reset();
    initialized.current = false;
    navigate('/');
  }, [stopAutoPlay, cleanup, reset, navigate]);

  const handleNewGame = useCallback(() => setShowExitConfirm(true), []);

  if (!gameId) return null;

  // ── Shared atmospheric overlays ───────────────────────────────────────────
  const atmosphericTint = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse 120% 80% at 50% 0%, rgba(16,36,64,0.45) 0%, transparent 60%)',
    }} />
  );
  const vignette = (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
      background: 'radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(6,11,21,0.5) 100%), linear-gradient(180deg, rgba(6,11,21,0.55) 0%, transparent 16%, transparent 68%, rgba(6,11,21,0.65) 100%)',
    }} />
  );

  // ── Shared board ──────────────────────────────────────────────────────────
  const boardEl = (camOffset: number) => (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
      {!gameState ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, border: '2.5px solid var(--glass-brd2)', borderTop: '2.5px solid var(--sapphire-bright)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Loading game…</div>
          </div>
        </div>
      ) : (
        <GameBoard3D onAction={handleAction} disabled={isDisabled} sidebarWidth={camOffset} />
      )}
    </div>
  );

  // ── Shared modals (all breakpoints) ───────────────────────────────────────
  const sharedModals = (
    <>
      <SettingsPanel />
      <AnnouncementBanner
        achievement={achievement}
        yourTurn={showYourTurn && humanPlayerIndices.length > 0 && gameState?.game_phase !== 'INITIAL_BUILD'}
        rightOffset={bp === 'mobile' ? 0 : layout.panelW + layout.gap}
        topOffset={bp === 'mobile' ? 100 : bp === 'tablet' ? 100 : 74}
      />
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

      {showTradeModal && gameState && (
        <TradeModal
          hand={humanPlayer?.resources ?? {} as ResourceCounts}
          bank={bankResources}
          maritimeActions={maritimeActions}
          onConfirm={handleAction}
          onClose={() => setShowTradeModal(false)}
        />
      )}

      {showOfferTradeModal && gameState && humanPlayer && (
        <OfferTradeModal
          hand={humanPlayer.resources}
          players={gameState.players.map((p, i) => ({ name: p.name, color: p.color, index: i }))}
          onConfirm={handleAction}
          onClose={() => setShowOfferTradeModal(false)}
        />
      )}

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

      {/* Year of Plenty picker */}
      <AnimatePresence>
        {showYopPicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(4,8,16,0.65)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={() => { setShowYopPicker(false); setYopFirstPick(null); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="panel"
              style={{ padding: '20px 18px', width: 320, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 14 }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <div className="eyebrow" style={{ marginBottom: 5 }}>Year of Plenty</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)' }}>
                  {yopFirstPick
                    ? `Got ${yopFirstPick} — pick your 2nd resource`
                    : 'Pick your 1st resource'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {RESOURCE_ORDER.map(res => (
                  <button
                    key={res}
                    onClick={() => {
                      if (!yopFirstPick) {
                        setYopFirstPick(res as ResourceType);
                      } else {
                        handleAction({ action_type: 'PLAY_YEAR_OF_PLENTY', value: [RESOURCE_ORDER.indexOf(yopFirstPick), RESOURCE_ORDER.indexOf(res)] });
                        setShowYopPicker(false);
                        setYopFirstPick(null);
                      }
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '10px 8px', borderRadius: 12, minWidth: 52,
                      background: yopFirstPick === res ? 'var(--glass-hi)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${yopFirstPick === res ? 'var(--sapphire-bright)' : 'var(--glass-brd)'}`,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--glass-hi)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = yopFirstPick === res ? 'var(--glass-hi)' : 'rgba(255,255,255,0.04)'; }}
                  >
                    <ResourceIcon type={res as ResourceType} size={26} shadow={false} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {res}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowYopPicker(false); setYopFirstPick(null); }}
                className="btn"
                style={{ padding: '8px 0', fontSize: 12, fontWeight: 700, width: '100%' }}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monopoly picker */}
      <AnimatePresence>
        {showMonoPicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(4,8,16,0.65)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={() => setShowMonoPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="panel"
              style={{ padding: '20px 18px', width: 320, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 14 }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <div className="eyebrow" style={{ marginBottom: 5 }}>Monopoly</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)' }}>
                  Claim all of one resource from every player
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {RESOURCE_ORDER.map(res => (
                  <button
                    key={res}
                    onClick={() => {
                      handleAction({ action_type: 'PLAY_MONOPOLY', value: RESOURCE_ORDER.indexOf(res) });
                      setShowMonoPicker(false);
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '10px 8px', borderRadius: 12, minWidth: 52,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--glass-brd)',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--glass-hi)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  >
                    <ResourceIcon type={res as ResourceType} size={26} shadow={false} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {res}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowMonoPicker(false)}
                className="btn"
                style={{ padding: '8px 0', fontSize: 12, fontWeight: 700, width: '100%' }}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  MOBILE LAYOUT  (<768px)
  // ══════════════════════════════════════════════════════════════════════════
  if (bp === 'mobile') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: 'var(--ff-ui)' }}>
        <FlyLayer />
        {atmosphericTint}
        {vignette}

        {/* ── Top area: bar + VP strip stacked (VP never overlaps the bar) ── */}
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, zIndex: 30,
          display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none',
        }}>
          {/* Compact top bar */}
          <div className="panel" style={{
            display: 'flex', flexDirection: 'column',
            borderRadius: 12, pointerEvents: 'auto', overflow: 'hidden',
          }}>
            {/* Row 1: Logo + turn info + controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
              {/* Logo mark */}
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb"/>
                <circle cx="8" cy="8" r="1.5" fill="#0e2244"/>
                <circle cx="16" cy="16" r="1.5" fill="#0e2244"/>
                <circle cx="12" cy="12" r="1.5" fill="var(--p-red)"/>
              </svg>
              <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', color: 'var(--text)', flexShrink: 0 }}>
                HEX
              </span>

              {/* Turn info */}
              {gameState && currentColor && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: PLAYER_COLORS[currentColor],
                    boxShadow: `0 0 6px ${PLAYER_COLORS[currentColor]}`,
                  }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)' }}>
                    T{gameState.num_turns}
                  </span>
                </span>
              )}

              {/* Controls */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 'auto' }}>
                {humanPlayerIndices.length === 0 && !replayMode && (
                  <button onClick={autoPlaying ? stopAutoPlay : startAutoPlay} className="btn"
                    style={{ padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                    {autoPlaying ? '⏸' : '⏵'}
                  </button>
                )}
                {gameState?.winner && !replayMode && (
                  <button onClick={handleEnterReplay} disabled={replayLoading} className="btn"
                    style={{ padding: '2px 7px', fontSize: 11, borderColor: 'rgba(160,130,235,0.4)', color: '#c4b5f5' }}>
                    {replayLoading ? '…' : '📼'}
                  </button>
                )}
                {replayMode && (
                  <button onClick={exitReplay} className="btn" style={{ padding: '2px 7px', fontSize: 11 }}>✕</button>
                )}
                <button onClick={handleNewGame} className="btn" style={{ padding: '2px 7px', fontSize: 11 }}>New</button>
                <button onClick={handleShare} className="btn" title="Copy spectator link"
                  style={{ width: 28, height: 28, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
                  <Icon name="users" size={13} color="var(--text-dim)" />
                </button>
                <button onClick={toggleMuted} className="btn" title={muted ? 'Unmute' : 'Mute'}
                  style={{ width: 28, height: 28, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
                  <Icon name={muted ? 'volume-x' : 'volume'} size={13} color={muted ? 'var(--text-ghost)' : 'var(--text-dim)'} />
                </button>
                <button onClick={() => setShowSettings(!showSettings)} className="btn" title="Settings"
                  style={{ width: 28, height: 28, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
                  <Icon name="gear" size={13} color="var(--text-dim)" />
                </button>
              </div>
            </div>

            {/* Row 2: Eval bar */}
            <div style={{ padding: '7px 12px 8px', borderTop: '1px solid var(--hairline)' }}>
              <EvalBar compact />
            </div>
          </div>

          {/* VP strip — sits directly below bar, left-aligned */}
          {gameState && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 6 }}>
              {gameState.players.map(p => {
                const col = PLAYER_COLORS[p.color as PlayerColor];
                const isActive = p.color === currentColor;
                return (
                  <span key={p.color} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px 3px 6px', borderRadius: 20,
                    background: 'rgba(6,11,21,0.62)',
                    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                    border: `1px solid ${isActive ? col : 'rgba(125,165,225,0.18)'}`,
                    boxShadow: isActive ? `0 0 8px ${col}44` : 'none',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, boxShadow: `0 0 5px ${col}` }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)' }}>{p.victory_points}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)' }}>VP</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Full-screen board (no sidebar offset) ── */}
        {boardEl(0)}

        {/* Hidden bank-anchor points for fly animation – sit at board centre so
            resource tokens arc downward from the board to the hand bar.
            These take priority over BankPanel anchors (which only exist when
            the Players drawer is open) because they appear earlier in the DOM. */}
        <div style={{ position: 'absolute', left: '50%', top: '42%', zIndex: 0, pointerEvents: 'none' }}>
          {RESOURCE_ORDER.map(res => (
            <span key={res} id={`bank-anchor-${res}`} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          ))}
        </div>

        {/* ── Left column: build strip above, DiceTray + Roll/End Turn below ── */}
        {gameState && !replayMode && (
          <div style={{
            position: 'absolute', left: 8,
            bottom: `calc(60px + env(safe-area-inset-bottom, 0px) + 6px)`,
            zIndex: 15, display: 'flex', flexDirection: 'column-reverse', gap: 8,
            pointerEvents: 'none',
          }}>
            {/* Dice panel */}
            <div className="panel" style={{ padding: '10px 12px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <DiceTray dice={lastRollDice} rolling={isRollingCompact} rollKey={rollKeyCompact} compact />
              {isHumanTurn && hasRoll && (
                <button onClick={handleCompactRoll} disabled={isDisabled || isRollingCompact}
                  className="btn btn-amber" style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 800 }}>
                  {isRollingCompact ? 'Rolling…' : '🎲 Roll Dice'}
                </button>
              )}
              {isHumanTurn && hasEndTurn && !hasRoll && (
                <button onClick={() => handleAction({ action_type: 'END_TURN', value: null })} disabled={isDisabled}
                  className="btn btn-primary" style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 800 }}>
                  End Turn
                </button>
              )}
            </div>

            {/* Build strip — stacks above dice via column-reverse */}
            {humanPlayer && !needsSpecialAction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'auto' }}>
                {compactBuildItems.map(item => {
                  const isActive = item.modeKey !== null && mode === item.modeKey;
                  const isItemDisabled = !item.available || !isHumanTurn || isDisabled;
                  return (
                    <button
                      key={item.key}
                      disabled={isItemDisabled}
                      onClick={() => {
                        if (item.modeKey !== null) setMode(mode === item.modeKey ? 'IDLE' : item.modeKey);
                        else if (item.directAction) handleAction({ action_type: item.directAction, value: null });
                      }}
                      className="btn"
                      style={{
                        position: 'relative', width: 42, height: 42, padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'var(--glass-hi)' : undefined,
                        borderColor: isActive ? 'var(--sapphire-bright)' : undefined,
                      }}
                    >
                      <Icon name={item.icon} size={18} color={isActive ? 'var(--sapphire-bright)' : 'var(--text-dim)'} />
                      {item.available && isHumanTurn && (
                        <span style={{
                          position: 'absolute', top: 3, right: 3,
                          width: 7, height: 7, borderRadius: '50%',
                          background: 'var(--amber)', boxShadow: '0 0 5px var(--amber-glow)',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Recent game log — right side, floats above resource bar ── */}
        {gameState && !replayMode && (() => {
          const recent = logEntries.filter(e => e.level === 'action').slice(-4);
          if (recent.length === 0) return null;
          const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
          return (
            <div style={{
              position: 'absolute', right: 8,
              bottom: `calc(60px + env(safe-area-inset-bottom, 0px) + 6px + 54px + 7px)`,
              zIndex: 14, maxWidth: 230, pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(6,11,21,0.46)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(125,165,225,0.10)',
                borderRadius: 10, padding: '6px 9px',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                {recent.map((entry, i) => {
                  const alpha = 0.4 + (i / Math.max(recent.length - 1, 1)) * 0.6;
                  let dotColor: string | null = null;
                  let text = entry.message;
                  if (entry.level === 'action') {
                    const pipe = entry.message.indexOf('|');
                    if (pipe !== -1) {
                      dotColor = PLAYER_COLORS[entry.message.slice(0, pipe) as PlayerColor] ?? null;
                      text = stripHtml(entry.message.slice(pipe + 1));
                    }
                  }
                  return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: alpha }}>
                      {dotColor
                        ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        : <span style={{ width: 6, flexShrink: 0 }} />
                      }
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                        {text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Resource counts — right side, aligns with bottom of dice panel ── */}
        {humanPlayer && !replayMode && gameState && (
          <div style={{
            position: 'absolute', right: 8,
            bottom: `calc(60px + env(safe-area-inset-bottom, 0px) + 6px)`,
            zIndex: 15, pointerEvents: 'none',
          }}>
            <div className="panel" style={{ padding: '7px 10px', pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 0 }}>
              {RESOURCE_ORDER.map(res => {
                const count = humanPlayer.resources[res as ResourceType] ?? 0;
                return (
                  <span key={res} id={`stack-anchor-${res}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '0 7px' }}>
                    <ResourceIcon type={res as ResourceType} size={16} shadow={false} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: count > 0 ? 'var(--text)' : 'var(--text-ghost)' }}>
                      {count}
                    </span>
                  </span>
                );
              })}
              {(() => {
                const totalDev = Object.values(humanPlayer.dev_cards_private).reduce((a, b) => a + b, 0);
                return totalDev > 0 ? (
                  <>
                    <div style={{ width: 1, height: 20, background: 'var(--hairline)', flexShrink: 0, margin: '0 4px' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber-soft)', padding: '0 4px', flexShrink: 0 }}>📦{totalDev}</span>
                  </>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {/* ── Replay controls + analysis on mobile ── */}
        {replayMode && gameState && (
          <div style={{
            position: 'absolute', bottom: `calc(env(safe-area-inset-bottom, 0px) + 8px)`,
            left: 8, right: 8, zIndex: 15, pointerEvents: 'auto',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div className="panel" style={{ pointerEvents: 'auto' }}>
              <ReplayControls compact />
            </div>
            <div className="panel" style={{ pointerEvents: 'auto', padding: '10px 12px' }}>
              <AnalysisPanel mobile />
            </div>
          </div>
        )}

        {/* ── Mobile drawer ── */}
        <AnimatePresence>
          {mobileDrawer && gameState && (
            <motion.div
              key="mobile-drawer"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) setMobileDrawer(null);
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="panel mobile-drawer"
              style={{
                position: 'absolute', left: 0, right: 0,
                bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
                zIndex: 20, maxHeight: '62vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Drag handle — only this area initiates the drag gesture */}
              <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'grab' }}>
                <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--glass-brd2)' }} />
              </div>
              {/* Stop pointer capture on content so native scroll works and drag doesn't fire here */}
              <div
                className="scrollbar-none"
                style={{ flex: 1, overflowY: 'auto', padding: '0 14px 20px' }}
                onPointerDownCapture={e => e.stopPropagation()}
              >
                {mobileDrawer === 'action' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ActionPanel onAction={handleAction} disabled={isDisabled} width="100%" />
                    {humanPlayer && (
                      <div className="scrollbar-none" style={{ overflowX: 'auto' }}>
                        <div style={{ paddingBottom: 4 }}>
                          <ResourceHand
                            resources={humanPlayer.resources}
                            devCards={humanPlayer.dev_cards_private}
                            isMyTurn={isHumanTurn && !isDisabled}
                            onPlayDev={(type) => { handlePlayDev(type); setMobileDrawer(null); }}
                            devCardsServerAllows={isHumanTurn ? devCardsServerAllows : undefined}
                            stacked
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {mobileDrawer === 'players' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <PlayerPanel />
                    <div style={{ height: 1, background: 'var(--hairline)' }} />
                    {/* Capped scrollable log — doesn't push bank off screen */}
                    <div style={{ maxHeight: 180, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <GameLog />
                    </div>
                    <div style={{ height: 1, background: 'var(--hairline)' }} />
                    <BankPanel
                      bank={bankResources}
                      canTrade={canTrade}
                      onTrade={() => { setShowTradeModal(true); setMobileDrawer(null); }}
                    />
                  </div>
                )}

                {/* Trade picker */}
                {mobileDrawer === 'trade' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="eyebrow">Trade</div>
                    <div style={{ display: 'flex', gap: 10 }}>

                      {/* Bank Trade */}
                      <button
                        onClick={() => { setShowTradeModal(true); setMobileDrawer(null); }}
                        disabled={!canTrade}
                        className="btn"
                        style={{
                          flex: 1, padding: '18px 14px', textAlign: 'left', height: 'auto',
                          display: 'flex', flexDirection: 'column', gap: 10,
                          background: canTrade
                            ? 'color-mix(in srgb, var(--amber) 9%, rgba(255,255,255,0.02))'
                            : 'rgba(255,255,255,0.02)',
                          borderColor: canTrade ? 'rgba(240,169,58,0.38)' : 'var(--hairline)',
                        }}
                      >
                        <span style={{ fontSize: 26 }}>🏦</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: canTrade ? 'var(--amber-soft)' : 'var(--text-ghost)' }}>
                            Bank Trade
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.4 }}>
                            {canTrade ? 'Trade resources at port rates' : 'No tradeable resources'}
                          </div>
                        </div>
                        {canTrade && maritimeGiveRates.size > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {Array.from(maritimeGiveRates.entries()).map(([res, rate]) => (
                              <span key={res} style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                fontSize: 10.5, fontWeight: 700,
                                color: rate <= 3 ? 'var(--amber)' : 'var(--text-faint)',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--hairline)',
                                borderRadius: 6, padding: '2px 7px',
                              }}>
                                <ResourceIcon type={res as ResourceType} size={12} shadow={false} />
                                {rate}:1
                              </span>
                            ))}
                          </div>
                        )}
                      </button>

                      {/* Player Trade */}
                      <button
                        onClick={() => { setShowOfferTradeModal(true); setMobileDrawer(null); }}
                        disabled={!isOfferTradeAllowed}
                        className="btn"
                        style={{
                          flex: 1, padding: '18px 14px', textAlign: 'left', height: 'auto',
                          display: 'flex', flexDirection: 'column', gap: 10,
                          background: isOfferTradeAllowed
                            ? 'color-mix(in srgb, var(--sapphire) 9%, rgba(255,255,255,0.02))'
                            : 'rgba(255,255,255,0.02)',
                          borderColor: isOfferTradeAllowed ? 'rgba(63,135,242,0.38)' : 'var(--hairline)',
                        }}
                      >
                        <span style={{ fontSize: 26 }}>🤝</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isOfferTradeAllowed ? 'var(--sapphire-bright)' : 'var(--text-ghost)' }}>
                            Player Trade
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.4 }}>
                            {isOfferTradeAllowed ? 'Offer to other players' : 'Roll dice first'}
                          </div>
                        </div>
                      </button>

                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom navigation bar ── */}
        {gameState && !replayMode && (
          <div className="panel mobile-bottom-bar" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 25,
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
            borderRadius: '16px 16px 0 0', background: 'var(--glass-2)',
          }}>
              {/* Game Menu */}
              <button
                onClick={() => setMobileDrawer(d => d === 'action' ? null : 'action')}
                className={`btn${needsSpecialAction && isHumanTurn && mobileDrawer !== 'action' ? ' btn-amber' : ''}`}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700,
                  background: (!needsSpecialAction || !isHumanTurn) && mobileDrawer === 'action' ? 'var(--glass-hi)' : undefined,
                  borderColor: mobileDrawer === 'action' ? 'var(--sapphire-bright)' : undefined,
                  color: mobileDrawer === 'action' ? 'var(--sapphire-bright)' : 'var(--text)',
                }}
              >
                {mobileDrawer === 'action'
                  ? 'Close'
                  : needsSpecialAction && isHumanTurn
                    ? 'Action!'
                    : 'Menu'}
              </button>

              <div style={{ width: 1, height: 28, background: 'var(--hairline)', flexShrink: 0 }} />

              {/* Trade */}
              <button
                onClick={() => setMobileDrawer(d => d === 'trade' ? null : 'trade')}
                className="btn"
                style={{
                  flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700,
                  background: mobileDrawer === 'trade'
                    ? 'color-mix(in srgb, var(--amber) 12%, var(--glass-hi))'
                    : (canTrade || isOfferTradeAllowed) && !mobileDrawer
                      ? 'color-mix(in srgb, var(--amber) 6%, rgba(255,255,255,0.02))'
                      : undefined,
                  borderColor: mobileDrawer === 'trade'
                    ? 'var(--amber)'
                    : (canTrade || isOfferTradeAllowed) ? 'rgba(240,169,58,0.3)' : undefined,
                  color: mobileDrawer === 'trade'
                    ? 'var(--amber-soft)'
                    : (canTrade || isOfferTradeAllowed) ? 'var(--amber-soft)' : 'var(--text)',
                }}
              >
                Trade
              </button>

              <div style={{ width: 1, height: 28, background: 'var(--hairline)', flexShrink: 0 }} />

              {/* Players */}
              <button
                onClick={() => setMobileDrawer(d => d === 'players' ? null : 'players')}
                className="btn"
                style={{
                  flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700,
                  background: mobileDrawer === 'players' ? 'var(--glass-hi)' : undefined,
                  borderColor: mobileDrawer === 'players' ? 'var(--sapphire-bright)' : undefined,
                  color: mobileDrawer === 'players' ? 'var(--sapphire-bright)' : 'var(--text)',
                }}
              >
                Players
              </button>
          </div>
        )}

        <PlacementHint
          gamePhase={gameState?.game_phase}
          isHumanTurn={isHumanTurn}
          hasBuildSettlement={hasBuildSettlement}
          hasBuildRoad={hasBuildRoad}
          replayMode={replayMode}
          rightOffset={0}
          topOffset={100}
        />

        {sharedModals}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TABLET + DESKTOP LAYOUT  (≥768px)
  // ══════════════════════════════════════════════════════════════════════════
  const { gap, panelW, camOffset, bottomOffset } = layout;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: 'var(--ff-ui)' }}>
      <FlyLayer />
      {atmosphericTint}
      {vignette}

      {/* ── Top bar ── */}
      <div className="panel" style={{
        position: 'absolute', top: gap, left: gap, right: camOffset, zIndex: 10,
        display: 'flex', flexDirection: bp === 'tablet' ? 'column' : 'row',
        alignItems: bp === 'tablet' ? 'stretch' : 'center',
        gap: 0, padding: 0, borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Main row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: bp === 'tablet' ? 10 : 12, padding: bp === 'tablet' ? '9px 14px' : '10px 16px', flex: bp !== 'tablet' ? 1 : undefined }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb"/>
              <circle cx="8" cy="8" r="1.5" fill="#0e2244"/>
              <circle cx="16" cy="16" r="1.5" fill="#0e2244"/>
              <circle cx="12" cy="12" r="1.5" fill="var(--p-red)"/>
            </svg>
            <span style={{
              fontFamily: 'var(--ff-display)', fontWeight: 700,
              fontSize: bp === 'tablet' ? 15 : 17,
              letterSpacing: '0.05em', color: 'var(--text)',
            }}>
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
                  {bp === 'desktop' && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>·</span>
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        {formatPhase(gameState.game_phase)}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Eval bar inline on desktop only */}
          {bp !== 'tablet' && (
            <>
              <span style={{ width: 1, height: 20, background: 'var(--hairline)', flexShrink: 0 }} />
              <EvalBar compact />
            </>
          )}

        {/* Right controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          {humanPlayerIndices.length === 0 && !replayMode && (
            <button onClick={autoPlaying ? stopAutoPlay : startAutoPlay} className="btn"
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {autoPlaying ? '⏸ Stop' : '⏵ Auto'}
            </button>
          )}

          {gameState?.winner && !replayMode && (
            <button
              onClick={handleEnterReplay}
              disabled={replayLoading}
              className="btn"
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700, borderColor: 'rgba(160,130,235,0.4)', color: '#c4b5f5', display: 'flex', alignItems: 'center', gap: 7, opacity: replayLoading ? 0.7 : 1 }}
            >
              {replayLoading ? (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #c4b5f5', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Loading…
                </>
              ) : '📼 Replay'}
            </button>
          )}

          {replayMode && (
            <button onClick={exitReplay} className="btn" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              ✕ Exit Replay
            </button>
          )}

          <button onClick={handleNewGame} className="btn" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            New Game
          </button>
          <button onClick={handleShare} className="btn" title="Copy spectator link"
            style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="users" size={13} color="var(--text-dim)" />
            Share
          </button>
          <button onClick={toggleMuted} className="btn" title={muted ? 'Unmute' : 'Mute'}
            style={{ width: 32, height: 32, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
            <Icon name={muted ? 'volume-x' : 'volume'} size={15} color={muted ? 'var(--text-ghost)' : 'var(--text-dim)'} />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="btn" title="Settings"
            style={{ width: 32, height: 32, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center' }}>
            <Icon name="gear" size={15} color="var(--text-dim)" />
          </button>
        </div>
        </div>
        {bp === 'tablet' && (
          <div style={{ padding: '7px 14px 9px', borderTop: '1px solid var(--hairline)' }}>
            <EvalBar compact />
          </div>
        )}
      </div>

      {/* ── Board ── */}
      {boardEl(camOffset)}

      {/* ── Bottom-left command zone ── */}
      {gameState && (
        <div style={{
          position: 'absolute', left: gap, bottom: bottomOffset, zIndex: 12,
          display: 'flex', alignItems: 'flex-end', gap: 16,
          pointerEvents: 'none',
        }}>
          {!replayMode ? (
            bp === 'desktop' ? (
              /* Desktop: full ActionPanel — trade phases float as a centred modal */
              <ActionPanel onAction={handleAction} disabled={isDisabled} floatTrade />
            ) : (
              /* Tablet: compact dice + build strip, full ActionPanel only for special phases */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, pointerEvents: 'auto' }}>
                {needsSpecialAction ? (
                  <ActionPanel onAction={handleAction} disabled={isDisabled} />
                ) : (
                  <>
                    {/* Build strip */}
                    {humanPlayer && (
                      <div className="panel" style={{ padding: '8px 7px', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                        {compactBuildItems.map(item => {
                          const isActive = item.modeKey !== null && mode === item.modeKey;
                          const isItemDisabled = !item.available || !isHumanTurn || isDisabled;
                          return (
                            <button
                              key={item.key}
                              disabled={isItemDisabled}
                              onClick={() => {
                                if (item.modeKey !== null) setMode(mode === item.modeKey ? 'IDLE' : item.modeKey);
                                else if (item.directAction) handleAction({ action_type: item.directAction, value: null });
                              }}
                              className="btn"
                              style={{
                                position: 'relative', width: 42, height: 42, padding: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isActive ? 'var(--glass-hi)' : undefined,
                                borderColor: isActive ? 'var(--sapphire-bright)' : undefined,
                              }}
                            >
                              <Icon name={item.icon} size={18} color={isActive ? 'var(--sapphire-bright)' : 'var(--text-dim)'} />
                              {item.available && isHumanTurn && (
                                <span style={{
                                  position: 'absolute', top: 3, right: 3,
                                  width: 7, height: 7, borderRadius: '50%',
                                  background: 'var(--amber)', boxShadow: '0 0 5px var(--amber-glow)',
                                }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Dice + Roll/End Turn */}
                    <div className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                      <DiceTray dice={lastRollDice} rolling={isRollingCompact} rollKey={rollKeyCompact} compact />
                      {isHumanTurn && hasRoll && (
                        <button onClick={handleCompactRoll} disabled={isDisabled || isRollingCompact}
                          className="btn btn-amber" style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 800 }}>
                          {isRollingCompact ? 'Rolling…' : '🎲 Roll Dice'}
                        </button>
                      )}
                      {isHumanTurn && hasEndTurn && !hasRoll && (
                        <button onClick={() => handleAction({ action_type: 'END_TURN', value: null })} disabled={isDisabled}
                          className="btn btn-primary" style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 800 }}>
                          End Turn
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="panel" style={{ padding: 12, pointerEvents: 'auto' }}>
              <ReplayControls />
            </div>
          )}

          {humanPlayer && !replayMode && (
            <div style={{ pointerEvents: 'auto' }}>
              <ResourceHand
                resources={humanPlayer.resources}
                devCards={humanPlayer.dev_cards_private}
                isMyTurn={isHumanTurn && !isDisabled}
                onPlayDev={handlePlayDev}
                devCardsServerAllows={isHumanTurn ? devCardsServerAllows : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Right sidebar ── */}
      <div className="panel" style={{
        position: 'absolute', top: gap, right: gap, bottom: gap, width: panelW, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        padding: bp === 'tablet' ? 12 : 16,
        gap: 14, overflow: 'hidden',
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

        {/* Perspective indicator */}
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

      <PlacementHint
        gamePhase={gameState?.game_phase}
        isHumanTurn={isHumanTurn}
        hasBuildSettlement={hasBuildSettlement}
        hasBuildRoad={hasBuildRoad}
        replayMode={replayMode}
        rightOffset={layout.panelW + layout.gap}
        topOffset={bp === 'tablet' ? 100 : 74}
      />

      {sharedModals}
    </div>
  );
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    INITIAL_BUILD:    'Setup',
    PLAY_TURN:        'Playing',
    DISCARDING:       'Discarding',
    MOVING_ROBBER:    'Moving Robber',
    ROAD_BUILDING:    'Road Building',
    RESOLVING_TRADE:  'Trade',
    DECIDE_ACCEPTEES: 'Confirm Trade',
  };
  return labels[phase] || phase;
}
