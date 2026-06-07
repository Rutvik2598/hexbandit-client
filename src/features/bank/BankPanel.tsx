// Each resource tile carries the DOM id "bank-anchor-{key}" consumed by FlyLayer.
import { Icon } from '@/shared/components/Icon';
import { ResourceIcon } from '@/shared/components/ResourceIcon';
import { RESOURCE_CONFIG } from '@/features/resource-hand/resourceConfig';
import type { ResourceCounts } from '@/shared/types/game';

interface BankPanelProps {
  bank: ResourceCounts;
  canTrade: boolean;
  onTrade: () => void;
}

export function BankPanel({ bank, canTrade, onTrade }: BankPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="bank" size={13} color="var(--text-faint)" />
        Bank
      </div>

      {/* resource tiles */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {RESOURCE_CONFIG.map(r => {
          const count = bank[r.key] ?? 0;
          return (
            <div key={r.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                id={`bank-anchor-${r.key}`}
                style={{
                  width: 36, height: 36, borderRadius: 9,
                  display: 'grid', placeItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid var(--hairline)`,
                  borderTop: `2.5px solid ${r.color}`,
                  transition: 'border-color 0.2s',
                }}
              >
                <ResourceIcon type={r.key} size={22} shadow={false} />
              </div>
              <span style={{
                fontSize: 12.5, fontWeight: 800,
                color: count === 0 ? 'var(--text-ghost)' : 'var(--text)',
                lineHeight: 1,
              }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* trade button */}
      <button
        onClick={() => canTrade && onTrade()}
        disabled={!canTrade}
        className={`btn${canTrade ? ' btn-amber' : ''}`}
        style={{
          padding: '11px 0',
          fontSize: 13,
          fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          letterSpacing: '0.02em',
          width: '100%',
        }}
      >
        <Icon name="swap" size={15} color={canTrade ? '#2a1a05' : 'var(--text-faint)'} />
        Trade with Bank
      </button>
    </div>
  );
}
