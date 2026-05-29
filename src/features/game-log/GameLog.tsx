import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import clsx from 'clsx';

const LEVEL_STYLES = {
  info: 'text-slate-300',
  error: 'text-red-400',
  success: 'text-green-400',
  action: 'text-blue-300',
};

const LEVEL_ICON = {
  info: '·',
  error: '✗',
  success: '✓',
  action: '▸',
};

export default function GameLog() {
  const logEntries = useGameStore(s => s.logEntries);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Game Log</span>
        <span className="text-xs text-slate-600">{logEntries.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 min-h-0">
        {logEntries.length === 0 ? (
          <div className="text-xs text-slate-600 text-center py-4">No events yet</div>
        ) : (
          logEntries.map(entry => (
            <div
              key={entry.id}
              className={clsx(
                'flex items-start gap-1.5 text-xs py-0.5 leading-relaxed',
                LEVEL_STYLES[entry.level],
              )}
            >
              {entry.level === 'action' ? (
                <span className="flex-shrink-0 text-slate-600 font-mono mt-0.5 min-w-[28px]">
                  T{entry.turn}
                </span>
              ) : (
                <span className="flex-shrink-0 text-slate-600 font-mono mt-0.5">
                  {LEVEL_ICON[entry.level]}
                </span>
              )}
              {entry.html ? (
                <span dangerouslySetInnerHTML={{ __html: entry.message }} />
              ) : (
                <span className="break-words">{entry.message}</span>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
