import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { analyzeMoveStep } from '@/services/api/movesApi';

export default function ReplayControls() {
  const replayMode = useGameStore(s => s.replayMode);
  const replayFrames = useGameStore(s => s.replayFrames);
  const replayStep = useGameStore(s => s.replayStep);
  const gameId = useGameStore(s => s.gameId);
  const setReplayStep = useGameStore(s => s.setReplayStep);
  const setGameState = useGameStore(s => s.setGameState);
  const setReplayAnalysis = useGameStore(s => s.setReplayAnalysis);

  const maxStep = replayFrames.length - 1;

  const goToStep = useCallback(async (step: number) => {
    const clamped = Math.max(0, Math.min(step, maxStep));
    setReplayStep(clamped);
    const frame = replayFrames[clamped];
    if (frame?.state) {
      setGameState(frame.state);
    }
    // Fetch analysis for this step
    if (gameId) {
      try {
        const analysis = await analyzeMoveStep({ game_id: gameId, step: clamped });
        setReplayAnalysis(analysis);
      } catch {
        setReplayAnalysis(null);
      }
    }
  }, [maxStep, replayFrames, gameId, setReplayStep, setGameState, setReplayAnalysis]);

  if (!replayMode) return null;

  const frame = replayFrames[replayStep];
  const action = frame?.action;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-slate-900/95 border border-slate-700/50 rounded-xl p-3 space-y-2 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider">Replay</span>
        <span>Step {replayStep + 1} / {maxStep + 1}</span>
      </div>

      {/* Current action */}
      {action && (
        <div className="text-xs text-slate-300 bg-slate-800/60 rounded-lg px-2 py-1.5">
          <span className="text-slate-500">{action.color}: </span>
          {action.description || action.action_type}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => goToStep(0)}
          disabled={replayStep === 0}
          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 text-sm"
          title="First"
        >⏮</button>
        <button
          onClick={() => goToStep(replayStep - 1)}
          disabled={replayStep === 0}
          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 text-sm"
          title="Previous"
        >◀</button>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={maxStep}
          value={replayStep}
          onChange={e => goToStep(parseInt(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer"
        />

        <button
          onClick={() => goToStep(replayStep + 1)}
          disabled={replayStep === maxStep}
          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 text-sm"
          title="Next"
        >▶</button>
        <button
          onClick={() => goToStep(maxStep)}
          disabled={replayStep === maxStep}
          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 text-sm"
          title="Last"
        >⏭</button>
      </div>
    </motion.div>
  );
}
