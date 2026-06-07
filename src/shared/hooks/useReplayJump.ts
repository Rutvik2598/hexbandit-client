import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { analyzeMoveStep } from '@/services/api/movesApi';

export function useReplayJump() {
  const replayFrames          = useGameStore(s => s.replayFrames);
  const gameId                = useGameStore(s => s.gameId);
  const gameState             = useGameStore(s => s.gameState);
  const humanIndices          = useGameStore(s => s.humanPlayerIndices);
  const setReplayStep         = useGameStore(s => s.setReplayStep);
  const setGameState          = useGameStore(s => s.setGameState);
  const setReplayAnalysis     = useGameStore(s => s.setReplayAnalysis);
  const setReplayAnalysisLoading = useGameStore(s => s.setReplayAnalysisLoading);

  const humanColors = new Set(
    humanIndices.map(i => gameState?.players[i]?.color).filter(Boolean) as string[]
  );
  const humanColorsKey = [...humanColors].join(',');

  const maxStep = replayFrames.length - 1;

  return useCallback(async (step: number) => {
    const clamped = Math.max(0, Math.min(step, maxStep));
    setReplayStep(clamped);
    const frame = replayFrames[clamped];
    if (frame?.state) setGameState(frame.state);

    const actionColor  = frame?.action?.color;
    const isHumanAction = actionColor ? humanColors.has(actionColor) : false;

    if (gameId && frame?.action && isHumanAction) {
      setReplayAnalysisLoading(true);
      try {
        const analysis = await analyzeMoveStep({ game_id: gameId, step: clamped });
        setReplayAnalysis(analysis);
      } catch (err) {
        console.error('[analyze] step', clamped, err);
        const msg = err instanceof Error ? err.message : 'Analysis unavailable';
        setReplayAnalysis({ step: clamped, explanation_error: msg });
      } finally {
        setReplayAnalysisLoading(false);
      }
    } else {
      setReplayAnalysis(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxStep, replayFrames, gameId, humanColorsKey]);
}
