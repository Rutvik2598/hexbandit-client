import { useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import { getGameState, submitMove, deleteGame, getRecording } from '@/services/api/gamesApi';
import { requestMove, requestEvaluate, pollUntilComplete } from '@/services/api/movesApi';
import { formatActionLogEvent, extractRollDice, extractRollGains } from '@/shared/utils/actionLog';
import { addToast } from '@/store/toastStore';
import type { PlayableAction, GameState } from '@/shared/types/game';

type StoreRef = ReturnType<typeof useGameStore.getState>;

function processActionLog(
  state: GameState,
  prevStore: StoreRef,
  addLog: (msg: string, level: 'info' | 'error' | 'success' | 'action', html?: boolean) => void,
  setResourceGains: (g: Record<string, Partial<Record<string, number>>> | null) => void,
  setLastRollDice: (d: [number, number] | null) => void,
  setActionLogTotal: (n: number) => void,
): void {
  const actionLog = state.action_log ?? [];
  const serverTotal = state.action_log_total ?? actionLog.length;
  const prevTotal = prevStore.actionLogTotal;
  const newCount = serverTotal - prevTotal;
  if (newCount <= 0) return;

  const players = state.players;
  const startIdx = Math.max(0, actionLog.length - newCount);

  for (let i = startIdx; i < actionLog.length; i++) {
    const event = actionLog[i];

    if (event.action_type === 'ROLL') {
      setLastRollDice(extractRollDice(event));
      setResourceGains(extractRollGains(event));
    }

    const html = formatActionLogEvent(event, players);
    if (html !== null) {
        addLog(`${event.color}|${html}`, 'action', true);
    }
  }

  setActionLogTotal(serverTotal);
}

export function useGameLoop() {
  const gameId = useGameStore(s => s.gameId);
  const gameState = useGameStore(s => s.gameState);
  const humanPlayerIndices = useGameStore(s => s.humanPlayerIndices);
  const autoPlaying = useGameStore(s => s.autoPlaying);
  const setGameState = useGameStore(s => s.setGameState);
  const setThinking = useGameStore(s => s.setThinking);
  const clearThinking = useGameStore(s => s.clearThinking);
  const updatePwin = useGameStore(s => s.updatePwin);
  const clearActionsPwin = useGameStore(s => s.clearActionsPwin);
  const setEvaluating = useGameStore(s => s.setEvaluating);
  const addLog = useGameStore(s => s.addLog);
  const setAutoPlaying = useGameStore(s => s.setAutoPlaying);
  const setResourceGains = useGameStore(s => s.setResourceGains);
  const setLastRollDice = useGameStore(s => s.setLastRollDice);
  const setActionLogTotal = useGameStore(s => s.setActionLogTotal);
  const setReplayMode = useGameStore(s => s.setReplayMode);
  const setReplayFrames = useGameStore(s => s.setReplayFrames);
  const setReplayStep = useGameStore(s => s.setReplayStep);
  const resetInteraction = useInteractionStore(s => s.resetInteraction);

  const aiInFlight = useRef(false);
  const humanInFlight = useRef(false);
  const autoPlayRunId = useRef(0);
  const autoAdvanceRunId = useRef(0);
  const evaluatingRef = useRef(false);
  const lastEvaluatedStep = useRef(-1);

  const isCurrentPlayerHuman = useCallback(() => {
    if (!gameState) return false;
    const currentIdx = gameState.current_player_index;
    return humanPlayerIndices.includes(currentIdx);
  }, [gameState, humanPlayerIndices]);

  // Reads fresh store state — safe to call from async callbacks that may capture stale closures.
  const isCurrentPlayerHumanNow = () => {
    const s = useGameStore.getState();
    if (!s.gameState) return false;
    return s.humanPlayerIndices.includes(s.gameState.current_player_index);
  };

  const refreshState = useCallback(async (): Promise<boolean> => {
    if (!gameId) return false;
    try {
      const s = useGameStore.getState();
          const perspectiveColor = s.perspectiveColor ?? undefined;
      const rawState = await getGameState(gameId, {
        perspectiveColor,
        actionLogStart: s.actionLogTotal,
      });
      setGameState(rawState);
      resetInteraction();
      processActionLog(rawState, s, addLog, setResourceGains, setLastRollDice, setActionLogTotal);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addLog(`Error refreshing state: ${msg}`, 'error');
      addToast('Could not load the latest game state. Check your connection.', 'error');
      return false;
    }
  }, [gameId, setGameState, resetInteraction, addLog, setResourceGains, setLastRollDice, setActionLogTotal]);

  const evaluatePosition = useCallback(async () => {
    if (evaluatingRef.current) return;
    const s = useGameStore.getState();
    if (!s.gameId || !s.perspectiveColor) return;
    if (s.gameState?.winner) return;
    if (s.gameState?.game_phase === 'INITIAL_BUILD') return;

    const requestStep = s.gameState?.action_step ?? 0;
    if (requestStep === s.lastPwinStep) return;
    if (requestStep === lastEvaluatedStep.current) return;

    evaluatingRef.current = true;
    lastEvaluatedStep.current = requestStep;
    setEvaluating(true);

    try {
      const submitResult = await requestEvaluate({
        game_id: s.gameId,
        perspective_color: s.perspectiveColor,
        requested_step: requestStep,
      });

      const pollResult = await pollUntilComplete(submitResult.request_id);

      if (pollResult.status === 'complete' && pollResult.pwin_result) {
        updatePwin(pollResult.pwin_result);
      }
    } catch {
      // Silently ignore — eval is best-effort
    } finally {
      evaluatingRef.current = false;
      setEvaluating(false);
    }
  }, [setEvaluating, updatePwin]);

  const doAiMove = useCallback(async (): Promise<boolean> => {
    if (!gameId || aiInFlight.current) return false;
    if (isCurrentPlayerHumanNow()) return false;

    const currentState = useGameStore.getState().gameState;
    if (!currentState) return false;

    const agentId = currentState.current_player_agent_id;

    if (agentId === 'human') return false;

    aiInFlight.current = true;
    try {
      setThinking({ phase: 'submitting', message: 'Requesting move…', progress: 0 });

      const submitResult = await requestMove({ game_id: gameId });

      const pollResult = await pollUntilComplete(submitResult.request_id, {
        onProgress: (progress, message) => {
          setThinking({ phase: 'thinking', message, progress });
        },
      });

      if (pollResult.status === 'error') {
        addLog(`Move error: ${pollResult.error || 'Unknown'}`, 'error');
        addToast('The AI ran into an error making its move.', 'error');
        clearThinking();
        return false;
      }

      if (!pollResult.result) {
        addLog('Move completed but no result returned', 'error');
        addToast('The AI move completed but returned no result.', 'warning');
        clearThinking();
        return false;
      }

      clearThinking();
      const ok = await refreshState();

      if (ok && isCurrentPlayerHumanNow()) {
        evaluatePosition();
      }

      return ok;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addLog(`AI move failed: ${msg}`, 'error');
      addToast('AI move failed. The game will try to continue.', 'error');
      clearThinking();
      return false;
    } finally {
      aiInFlight.current = false;
    }
  }, [gameId, setThinking, clearThinking, addLog, refreshState, evaluatePosition]);

  const submitAction = useCallback(async (action: PlayableAction) => {
    if (!gameId || humanInFlight.current) return;
    humanInFlight.current = true;
    clearActionsPwin();

    const requestStep = gameState?.action_step ?? 0;

    try {
      await submitMove(gameId, {
        player_id: 'human',
        action_type: action.action_type,
        action_data: { value: action.value },
        requested_step: requestStep,
      });

      const ok = await refreshState();
      if (!ok) return;

      const newStep = useGameStore.getState().gameState?.action_step ?? 0;
      if (newStep > requestStep) {
        evaluatePosition();
      }

      const nowHuman = isCurrentPlayerHumanNow();
      if (!nowHuman && !autoPlaying) {
        autoAdvanceAI();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addLog(`Move error: ${msg}`, 'error');
      addToast('Your move could not be submitted. Please try again.', 'error');
      await refreshState();
    } finally {
      humanInFlight.current = false;
    }
  }, [gameId, gameState, autoPlaying, addLog, refreshState, evaluatePosition, clearActionsPwin]);

  const autoAdvanceAI = useCallback(async () => {
    const runId = ++autoAdvanceRunId.current;
    while (
      gameId &&
      !useGameStore.getState().gameState?.winner &&
      !isCurrentPlayerHumanNow() &&
      autoAdvanceRunId.current === runId &&
      !useGameStore.getState().autoPlaying
    ) {
      const ok = await doAiMove();
      if (!ok) break;
      await new Promise(r => setTimeout(r, 300));
    }
  }, [gameId, doAiMove]);

  const startAutoPlay = useCallback(async () => {
    setAutoPlaying(true);
    const runId = ++autoPlayRunId.current;
    while (
      useGameStore.getState().autoPlaying &&
      gameId &&
      autoPlayRunId.current === runId
    ) {
      const state = useGameStore.getState().gameState;
      if (!state || state.winner) {
        setAutoPlaying(false);
        break;
      }
      if (isCurrentPlayerHuman()) {
        setAutoPlaying(false);
        break;
      }
      const ok = await doAiMove();
      if (!ok) {
        setAutoPlaying(false);
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }, [gameId, isCurrentPlayerHuman, doAiMove, setAutoPlaying, addLog]);

  const stopAutoPlay = useCallback(() => {
    setAutoPlaying(false);
    autoPlayRunId.current++;
  }, [setAutoPlaying]);

  const enterReplay = useCallback(async () => {
    if (!gameId) return;
    try {
      const recording = await getRecording(gameId);
      if (!recording.frames || recording.frames.length === 0) {
        addLog('No recording available', 'info');
        addToast('No replay recording available for this game.', 'info');
        return;
      }
      setReplayFrames(recording.frames);
      setReplayStep(0);
      setReplayMode(true);
      if (recording.frames[0]?.state) {
        setGameState(recording.frames[0].state);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addLog(`Failed to load replay: ${msg}`, 'error');
      addToast('Could not load the game replay. Please try again.', 'error');
    }
  }, [gameId, setReplayFrames, setReplayStep, setReplayMode, setGameState, addLog]);

  const exitReplay = useCallback(() => {
    setReplayMode(false);
    refreshState();
  }, [setReplayMode, refreshState]);

  const cleanup = useCallback(async () => {
    if (gameId) {
      try { await deleteGame(gameId); } catch {}
    }
  }, [gameId]);

  return {
    refreshState,
    evaluatePosition,
    submitAction,
    autoAdvanceAI,
    startAutoPlay,
    stopAutoPlay,
    isCurrentPlayerHuman,
    enterReplay,
    exitReplay,
    cleanup,
  };
}
