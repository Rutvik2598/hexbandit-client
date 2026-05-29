import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { ActionRecord } from '@/shared/types/game';

function ActionDisplay({ action, label, playerColor }: {
  action: ActionRecord | null | undefined;
  label: string;
  playerColor?: string;
}) {
  if (!action) return (
    <div className="bg-slate-800/50 rounded-xl p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-sm text-slate-600">—</div>
    </div>
  );

  const pwin = action.pwin_by_color && playerColor ? action.pwin_by_color[playerColor] : null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        {pwin !== null && pwin !== undefined && (
          <span className="text-xs font-bold text-green-400">
            {Math.round(pwin * 100)}% win
          </span>
        )}
      </div>
      <div className="text-sm text-slate-200 font-medium">
        {action.description || action.action_type}
      </div>
    </div>
  );
}

export default function AnalysisPanel() {
  const analysis = useGameStore(s => s.replayAnalysis);
  const isReplay = useGameStore(s => s.replayMode);

  if (!isReplay) return null;

  return (
    <AnimatePresence>
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="bg-slate-900/90 border border-slate-700/50 rounded-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Move Analysis
            </span>
            {analysis.acting_player && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: PLAYER_COLORS[analysis.acting_player as keyof typeof PLAYER_COLORS] || '#ccc',
                  backgroundColor: (PLAYER_COLORS[analysis.acting_player as keyof typeof PLAYER_COLORS] || '#ccc') + '20',
                }}
              >
                {analysis.acting_player}
              </span>
            )}
          </div>

          <div className="p-3 space-y-2">
            <ActionDisplay
              action={analysis.action_taken}
              label="Move Taken"
              playerColor={analysis.acting_player || undefined}
            />
            <ActionDisplay
              action={analysis.best_action}
              label="Best Move"
              playerColor={analysis.acting_player || undefined}
            />

            {analysis.win_probability_delta && (
              <div className="text-xs text-slate-400 bg-slate-800/40 rounded-lg p-2">
                Delta: <span className="text-amber-400 font-bold">{analysis.win_probability_delta}</span>
              </div>
            )}

            {analysis.explanation && (
              <div className="text-xs text-slate-300 bg-slate-800/40 rounded-lg p-2 leading-relaxed">
                {analysis.explanation}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
