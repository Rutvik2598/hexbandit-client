// The count chip carries the DOM id "stack-anchor-{key}" consumed by FlyLayer.
import { useState } from 'react';
import { ResourceIcon } from '@/shared/components/ResourceIcon';
import type { ResourceType } from '@/shared/types/game';
import type { ResourceConfig } from './resourceConfig';

// Physical card face
function ResCard({ color, name, resKey, enough }: {
  color: string; name: string; resKey: ResourceType; enough: boolean;
}) {
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 10, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(168deg,#f8f3e9 0%,#ece3d2 78%,#e2d7c2 100%)',
      border: `1px solid ${enough ? 'var(--amber)' : 'rgba(40,30,15,0.32)'}`,
      boxShadow: enough
        ? '0 0 0 2px var(--amber), 0 10px 22px -8px rgba(0,0,0,.7)'
        : '0 8px 18px -8px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.85)',
    }}>
      {/* top stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: color }} />
      {/* bottom stripe */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: color, opacity: 0.75 }} />
      {/* inner frame */}
      <div style={{
        position: 'absolute', inset: 7, borderRadius: 6,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }} />
      {/* top-left mini icon */}
      <div style={{ position: 'absolute', top: 8, left: 7 }}>
        <ResourceIcon type={resKey} size={12} shadow={false} />
      </div>
      {/* centre illustration */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, paddingTop: 4,
      }}>
        <div style={{
          display: 'grid', placeItems: 'center', width: 44, height: 44,
          background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${color} 22%, #fff) 0%, transparent 68%)`,
        }}>
          <ResourceIcon type={resKey} size={40} shadow={false} />
        </div>
        <span style={{
          fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: `color-mix(in srgb, ${color} 64%, #1c1206)`,
          opacity: 0.85,
        }}>{name}</span>
      </div>
      {/* bottom-right rotated icon */}
      <div style={{ position: 'absolute', bottom: 8, right: 7, transform: 'rotate(180deg)' }}>
        <ResourceIcon type={resKey} size={12} shadow={false} />
      </div>
    </div>
  );
}

interface ResourceStackProps {
  resource: ResourceConfig;
  count: number;
  /** How many of this resource a pending build costs (highlights when affordable). */
  need?: number;
}

const CARD_W = 68;
const CARD_H = 100;

export function ResourceStack({ resource, count, need = 0 }: ResourceStackProps) {
  const [hovered, setHovered] = useState(false);

  const enough  = need > 0 && count >= need;
  const drawn   = Math.min(Math.max(count, 1), 7);
  const baseStep = count <= 5 ? 11 : count <= 8 ? 9 : 6;
  const step    = hovered ? 0 : baseStep;
  const fan     = hovered ? 15 : 0;
  const stackH  = CARD_H + baseStep * (drawn - 1);
  const stackW  = CARD_W + (hovered ? fan * (drawn - 1) : 0);
  const ink     = `color-mix(in srgb, ${resource.color} 64%, #1c1206)`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: CARD_W,
        height: stackH + 14,
        cursor: 'default',
        zIndex: hovered ? 50 : (enough ? 30 : 1),
      }}
    >
      {/* card stack */}
      <div style={{
        position: 'absolute', left: 0, bottom: 14,
        width: stackW, height: stackH,
        transition: 'width 0.22s ease',
      }}>
        {count === 0 ? (
          <div style={{
            position: 'absolute', left: 0, bottom: 0, width: CARD_W, height: CARD_H, borderRadius: 10,
            border: '1.5px dashed rgba(180,195,220,0.28)',
            background: 'rgba(255,255,255,0.02)',
            display: 'grid', placeItems: 'center',
          }}>
            <span style={{ opacity: 0.4 }}>
              <ResourceIcon type={resource.key} size={26} shadow={false} />
            </span>
          </div>
        ) : Array.from({ length: drawn }).map((_, j) => {
          const isTop = j === drawn - 1;
          return (
            <div key={j} style={{
              position: 'absolute',
              bottom: j * step,
              left: hovered ? j * fan : 0,
              width: CARD_W,
              height: CARD_H,
              transition: 'bottom 0.22s cubic-bezier(.2,1.2,.4,1), left 0.22s ease, transform 0.22s ease',
              transform: hovered
                ? `translateY(-24px) rotate(${(j - (drawn - 1) / 2) * 3}deg)`
                : 'none',
              transformOrigin: 'bottom center',
            }}>
              <ResCard
                color={resource.color}
                name={resource.name}
                resKey={resource.key}
                enough={enough && isTop}
              />
            </div>
          );
        })}
      </div>

      {/* count chip — carries the DOM id used by FlyLayer */}
      <div
        id={`stack-anchor-${resource.key}`}
        style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          minWidth: 32, height: 24, padding: '0 9px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 4,
          background: count === 0
            ? 'var(--bg-3)'
            : 'linear-gradient(180deg,#fff,#e6ddc8)',
          color: count === 0 ? 'var(--text-faint)' : ink,
          fontWeight: 800, fontSize: 13,
          border: enough ? '1.5px solid var(--amber)' : '1.5px solid var(--bg-1)',
          boxShadow: enough ? '0 0 14px -2px var(--amber-glow)' : '0 4px 10px -3px rgba(0,0,0,0.6)',
          zIndex: 60,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ transform: 'scale(0.85)', display: 'flex' }}>
          <ResourceIcon type={resource.key} size={13} shadow={false} />
        </span>
        ×{count}
      </div>
    </div>
  );
}
