import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_COLORS } from '@/shared/constants';
import type { PlayerColor } from '@/shared/types/game';

export default function GameLog() {
  const logEntries = useGameStore(s => s.logEntries);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logEntries.length]);

  const visible = logEntries.filter(e => e.level === 'action' || e.level === 'error');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="eyebrow" style={{ padding: '0 2px 8px', flexShrink: 0 }}>
        Game Log
      </div>
      <div
        ref={ref}
        style={{
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          paddingRight: 3,
          flex: 1,
          minHeight: 0,
        }}
      >
        {visible.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 12 }}>
            No events yet
          </div>
        ) : (
          visible.map((entry, i) => {
            const isLast = i === visible.length - 1;

            // Action entries are stored as "COLOR|<html text>"
            let dotColor: string | null = null;
            let html: string = entry.message;

            if (entry.level === 'action') {
              const pipe = entry.message.indexOf('|');
              if (pipe !== -1) {
                const colorKey = entry.message.slice(0, pipe) as PlayerColor;
                dotColor = PLAYER_COLORS[colorKey] ?? null;
                html = entry.message.slice(pipe + 1);
              }
            }

            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '5px 7px', borderRadius: 7,
                  background: isLast ? 'rgba(255,255,255,0.04)' : 'transparent',
                  animation: isLast ? 'logIn 0.18s ease' : 'none',
                }}
              >
                {dotColor ? (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    background: dotColor,
                    boxShadow: `0 0 7px ${dotColor}`,
                    border: dotColor === PLAYER_COLORS.WHITE ? '1px solid rgba(0,0,0,0.3)' : 'none',
                  }} />
                ) : (
                  <span style={{
                    fontSize: 10,
                    color: entry.level === 'error' ? 'var(--color-error, #ef4444)' : 'var(--text-ghost)',
                    flexShrink: 0, marginTop: 3, minWidth: 8, textAlign: 'center',
                  }}>
                    {entry.level === 'error' ? '!' : '·'}
                  </span>
                )}
                <span style={{
                  fontSize: 12,
                  color: entry.level === 'error' ? 'var(--color-error, #ef4444)' : 'var(--text-dim)',
                  lineHeight: 1.4,
                }}>
                  {entry.html
                    ? <span dangerouslySetInnerHTML={{ __html: html }} />
                    : html
                  }
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
