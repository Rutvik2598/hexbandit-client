import { useState } from 'react';
import { ImgIcon } from '@/shared/components/ResourceIcon';
import type { IconKey } from '@/shared/components/ResourceIcon';
import type { DevCardType } from '@/shared/types/game';

interface DevTypeConfig {
  name: string;
  icon: IconKey;
  playable: boolean;
  blurb: string;
}

export const DEV_TYPE_CONFIG: Record<DevCardType, DevTypeConfig> = {
  knight:         { name: 'Knight',         icon: 'knight',         playable: true,  blurb: 'Move the robber & steal' },
  road_building:  { name: 'Road Building',  icon: 'road_building',  playable: true,  blurb: 'Place 2 free roads' },
  year_of_plenty: { name: 'Year of Plenty', icon: 'year_of_plenty', playable: true,  blurb: 'Take any 2 resources' },
  monopoly:       { name: 'Monopoly',       icon: 'monopoly',       playable: true,  blurb: 'Claim all of one resource' },
  victory_point:  { name: 'Victory Point',  icon: 'victory_point',  playable: false, blurb: 'Hidden +1 victory point' },
};

interface DevStackProps {
  type: DevCardType;
  count: number;
  isMyTurn: boolean;
  /** False means server doesn't allow playing this card right now (bought this turn or already played one). */
  serverCanPlay?: boolean;
  onPlay: (type: DevCardType) => void;
}

const CARD_W = 68;
const CARD_H = 100;

export function DevStack({ type, count, isMyTurn, serverCanPlay, onPlay }: DevStackProps) {
  const [hovered, setHovered] = useState(false);
  const d = DEV_TYPE_CONFIG[type];

  // locked = your turn + have the card + server explicitly says NO
  const locked   = d.playable && isMyTurn && count > 0 && serverCanPlay === false;
  const playable = d.playable && isMyTurn && count > 0 && !locked;
  const violet   = d.playable;
  const accent   = violet ? '#a98bff' : 'var(--amber)';

  const drawn    = Math.min(count, 7);
  const baseStep = count <= 5 ? 11 : count <= 8 ? 9 : 6;
  const step     = hovered ? 0 : baseStep;
  const fan      = hovered ? 15 : 0;
  const stackH   = CARD_H + baseStep * (drawn - 1);
  const stackW   = CARD_W + (hovered ? fan * (drawn - 1) : 0);

  return (
    <div
      title={`${d.name}${count > 1 ? ` ×${count}` : ''} — ${d.blurb}`}
      onClick={() => playable && onPlay(type)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: CARD_W,
        height: stackH + 14,
        cursor: playable ? 'pointer' : 'default',
        zIndex: hovered ? 50 : 1,
      }}
    >
      {/* card stack */}
      <div style={{
        position: 'absolute', left: 0, bottom: 14,
        width: stackW, height: stackH,
        transition: 'width 0.22s ease',
      }}>
        {Array.from({ length: drawn }).map((_, j) => {
          const isTop = j === drawn - 1;
          return (
            <div key={j} style={{
              position: 'absolute',
              bottom: j * step,
              left: hovered ? j * fan : 0,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 10,
              overflow: 'hidden',
              transition: 'bottom 0.22s cubic-bezier(.2,1.2,.4,1), left 0.22s ease, transform 0.22s ease',
              transform: hovered
                ? `translateY(-24px) rotate(${(j - (drawn - 1) / 2) * 3}deg)`
                : 'none',
              transformOrigin: 'bottom center',
              background: violet
                ? 'linear-gradient(168deg,#3a2d6e 0%,#2a2152 70%,#1d1740 100%)'
                : 'linear-gradient(168deg,#5a4416 0%,#3e2f10 70%,#2a1f08 100%)',
              border: `1px solid ${violet ? 'rgba(150,130,235,0.5)' : 'rgba(240,169,58,0.5)'}`,
              boxShadow: isTop
                ? `0 10px 22px -8px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,0.18)${
                    playable && isTop ? `, 0 0 0 2px ${accent}, 0 0 22px -3px ${accent}` : ''
                  }`
                : '0 6px 14px -8px rgba(0,0,0,.6)',
            }}>
              {/* top stripe */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 5,
                background: violet
                  ? 'linear-gradient(90deg,#7b62e8,#a98bff)'
                  : 'linear-gradient(90deg,#f0a93a,#f6c876)',
              }} />
              {/* bottom stripe */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 5,
                background: violet ? '#6a55c8' : '#b8791d', opacity: 0.8,
              }} />
              {/* inner frame */}
              <div style={{
                position: 'absolute', inset: 7, borderRadius: 6,
                border: `1px solid ${violet ? 'rgba(150,130,235,0.35)' : 'rgba(240,169,58,0.35)'}`,
              }} />
              {/* top-left index icon */}
              <div style={{ position: 'absolute', top: 8, left: 7 }}>
                <ImgIcon name={d.icon} size={13} />
              </div>

              {/* "NEW — can't play" badge */}
              {isTop && locked && (
                <div style={{
                  position: 'absolute', top: 7, right: 5,
                  fontSize: 6, fontWeight: 800, letterSpacing: '0.1em',
                  padding: '2px 5px', borderRadius: 4,
                  background: 'rgba(250,200,40,0.15)',
                  border: '1px solid rgba(250,200,40,0.5)',
                  color: '#ffd04a',
                }}>
                  NEW
                </div>
              )}
              {/* centre */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, paddingTop: 4,
              }}>
                <ImgIcon name={d.icon} size={40} />
                <span style={{
                  fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: violet ? '#d4c9f5' : 'var(--amber-soft)',
                  textAlign: 'center', lineHeight: 1.05, padding: '0 4px',
                }}>{d.name}</span>
                <span style={{
                  fontSize: 6.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: violet
                    ? (playable ? '#a98bff' : '#7a6db0')
                    : '#b8791d',
                  marginTop: 1,
                }}>
                  {violet
                    ? locked   ? "🔒 Can't play now"
                    : playable ? '▶ Tap to play'
                               : 'Your turn only'
                    : '★ +1 VP held'
                  }
                </span>
              </div>
              {/* bottom-right rotated icon */}
              <div style={{ position: 'absolute', bottom: 8, right: 7, transform: 'rotate(180deg)' }}>
                <ImgIcon name={d.icon} size={13} />
              </div>
            </div>
          );
        })}
      </div>

      {/* count chip */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        minWidth: 28, height: 22, padding: '0 8px', borderRadius: 11,
        display: 'flex', alignItems: 'center', gap: 3,
        background: 'linear-gradient(180deg,#fff,#e2dcf0)',
        color: '#2a2152', fontWeight: 800, fontSize: 12,
        border: `1.5px solid ${playable ? accent : locked ? 'rgba(250,200,40,0.45)' : 'var(--bg-1)'}`,
        boxShadow: playable ? `0 0 12px -2px ${accent}` : locked ? '0 0 8px -3px rgba(250,200,40,0.4)' : '0 4px 9px -3px rgba(0,0,0,0.6)',
        zIndex: 60,
      }}>
        {violet
          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="#5e49c4" stroke="none"><path d="M7 4l13 8-13 8z"/></svg>
          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#b8791d" strokeWidth="2"><path d="M12 3l2.6 5.6L20.5 9.5l-4.3 4.1 1 6L12 16.9 6.8 19.6l1-6L3.5 9.5l5.9-.9z"/></svg>
        }
        ×{count}
      </div>
    </div>
  );
}

// Empty state placeholder
export function DevHandEmpty() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 7, width: 100, height: 120, borderRadius: 12,
      border: '1.5px dashed rgba(150,130,235,0.28)',
      color: 'var(--text-faint)', fontSize: 11, fontWeight: 600, textAlign: 'center', padding: '0 10px',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(150,130,235,0.6)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="18" rx="2"/>
        <path d="M9 8h6M9 12h6M9 16h3"/>
      </svg>
      No dev cards
    </div>
  );
}
