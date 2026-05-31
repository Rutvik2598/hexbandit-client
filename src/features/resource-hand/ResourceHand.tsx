/**
 * ResourceHand — the bottom-centre command zone for the current human player.
 * Shows five resource stacks + dev card stacks side by side.
 */
import { ResourceStack, RESOURCE_CONFIG } from './ResourceStack';
import { DevStack, DevHandEmpty } from './DevStack';
import type { ResourceCounts, DevCardCounts, DevCardType } from '@/shared/types/game';

interface ResourceHandProps {
  resources: ResourceCounts;
  devCards: DevCardCounts;
  isMyTurn: boolean;
  /** Optional cost breakdown for build-affordability highlights. */
  buildCost?: Partial<Record<string, number>> | null;
  onPlayDev: (type: DevCardType) => void;
}

export function ResourceHand({
  resources,
  devCards,
  isMyTurn,
  buildCost,
  onPlayDev,
}: ResourceHandProps) {
  // Which dev types does the player have?
  const heldTypes = (Object.keys(devCards) as DevCardType[]).filter(t => devCards[t] > 0);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
      {/* Resource stacks */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        {RESOURCE_CONFIG.map(r => (
          <ResourceStack
            key={r.key}
            resource={r}
            count={resources[r.key] ?? 0}
            need={buildCost?.[r.key] ?? 0}
          />
        ))}
      </div>

      {/* Divider */}
      <div style={{
        width: 1, alignSelf: 'stretch',
        background: 'var(--hairline)',
        margin: '10px 0',
        flexShrink: 0,
      }} />

      {/* Dev card stacks */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: 10 }}>
        {heldTypes.length === 0
          ? <DevHandEmpty />
          : heldTypes.map(t => (
              <DevStack
                key={t}
                type={t}
                count={devCards[t]}
                isMyTurn={isMyTurn}
                onPlay={onPlayDev}
              />
            ))
        }
      </div>
    </div>
  );
}
