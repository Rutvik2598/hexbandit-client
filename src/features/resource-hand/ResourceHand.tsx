import { ResourceStack } from './ResourceStack';
import { RESOURCE_CONFIG } from './resourceConfig';
import { DevStack, DevHandEmpty } from './DevStack';
import type { ResourceCounts, DevCardCounts, DevCardType } from '@/shared/types/game';

interface ResourceHandProps {
  resources: ResourceCounts;
  devCards: DevCardCounts;
  isMyTurn: boolean;
  /** Optional cost breakdown for build-affordability highlights. */
  buildCost?: Partial<Record<string, number>> | null;
  onPlayDev: (type: DevCardType) => void;
  /** If true, dev cards stack below resource cards instead of beside them. */
  stacked?: boolean;
  /** Whether each playable card type is currently allowed by the server. */
  devCardsServerAllows?: Partial<Record<string, boolean>>;
}

export function ResourceHand({
  resources,
  devCards,
  isMyTurn,
  buildCost,
  onPlayDev,
  stacked = false,
  devCardsServerAllows,
}: ResourceHandProps) {
  const heldTypes = (Object.keys(devCards) as DevCardType[]).filter(t => devCards[t] > 0);

  if (stacked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

        {/* Horizontal divider */}
        <div style={{ height: 1, background: 'var(--hairline)' }} />

        {/* Dev card stacks */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          {heldTypes.length === 0
            ? <DevHandEmpty />
            : heldTypes.map(t => (
                <DevStack
                  key={t}
                  type={t}
                  count={devCards[t]}
                  isMyTurn={isMyTurn}
                  serverCanPlay={devCardsServerAllows ? devCardsServerAllows[t] : undefined}
                  onPlay={onPlayDev}
                />
              ))
          }
        </div>
      </div>
    );
  }

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

      {/* Vertical divider */}
      <div style={{
        width: 1, alignSelf: 'stretch',
        background: 'var(--hairline)',
        margin: '10px 0',
        flexShrink: 0,
      }} />

      {/* Dev card stacks */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: 10 }}>
        {heldTypes.length === 0
          ? <DevHandEmpty />
          : heldTypes.map(t => (
              <DevStack
                key={t}
                type={t}
                count={devCards[t]}
                isMyTurn={isMyTurn}
                serverCanPlay={devCardsServerAllows ? devCardsServerAllows[t] : undefined}
                onPlay={onPlayDev}
              />
            ))
        }
      </div>
    </div>
  );
}
