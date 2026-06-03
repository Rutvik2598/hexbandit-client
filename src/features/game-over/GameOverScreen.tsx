import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/Icon';
import { PLAYER_COLORS } from '@/shared/constants';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import type { GameState, Player, PlayerColor } from '@/shared/types/game';

interface VpChip {
  label: string;
  vp: number;
  icon?: 'settlement' | 'city' | 'road-badge' | 'army-badge' | 'devcard';
  count?: number;
}

interface RankedPlayer {
  player: Player;
  rank: number;
  breakdown: VpChip[];
  isHuman: boolean;
}

interface Props {
  gameState: GameState;
  humanPlayerIndices: number[];
  onPlayAgain: () => void;
  onMenu: () => void;
  onReplay: () => void;
  replayLoading?: boolean;
}

const MEDAL_COLORS = ['#f0c14b', '#cdd7e6', '#cf913f'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function buildBreakdown(p: Player): VpChip[] {
  const chips: VpChip[] = [];
  if (p.has_largest_army) chips.push({ label: 'Largest Army', vp: 2, icon: 'army-badge' });
  if (p.has_longest_road) chips.push({ label: 'Longest Road', vp: 2, icon: 'road-badge' });
  const vpCards = p.dev_cards_private?.victory_point ?? 0;
  if (vpCards > 0) chips.push({ label: 'VP Cards', vp: vpCards, icon: 'devcard', count: vpCards });
  if (p.cities > 0) chips.push({ label: p.cities === 1 ? 'City' : 'Cities', vp: p.cities * 2, icon: 'city', count: p.cities });
  if (p.settlements > 0) chips.push({ label: p.settlements === 1 ? 'Settlement' : 'Settlements', vp: p.settlements, icon: 'settlement', count: p.settlements });
  return chips;
}

function Crown({ winnerColor, size = 92 }: { winnerColor: string; size?: number }) {
  const h = Math.round(size * 0.76);
  return (
    <svg
      width={size} height={h} viewBox="0 0 92 70"
      style={{ animation: 'crownGlow 2.6s ease-in-out infinite' }}
    >
      <defs>
        <linearGradient id="crownGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe49b" />
          <stop offset="1" stopColor="#e9a32c" />
        </linearGradient>
      </defs>
      <path d="M10 58 L6 20 L28 38 L46 8 L64 38 L86 20 L82 58 Z"
        fill="url(#crownGrad)" stroke="#b8791d" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="56" width="72" height="11" rx="3" fill="url(#crownGrad)" stroke="#b8791d" strokeWidth="2" />
      <circle cx="46" cy="8" r="5" fill="#fff3d4" stroke="#b8791d" strokeWidth="2" />
      <circle cx="6" cy="20" r="4" fill="#fff3d4" stroke="#b8791d" strokeWidth="2" />
      <circle cx="86" cy="20" r="4" fill="#fff3d4" stroke="#b8791d" strokeWidth="2" />
      <circle cx="34" cy="52" r="3.4" fill={winnerColor} stroke="#b8791d" strokeWidth="1.5" />
      <circle cx="46" cy="52" r="3.4" fill={winnerColor} stroke="#b8791d" strokeWidth="1.5" />
      <circle cx="58" cy="52" r="3.4" fill={winnerColor} stroke="#b8791d" strokeWidth="1.5" />
    </svg>
  );
}

function Confetti({ celebrate }: { celebrate: boolean }) {
  const pieces = useMemo(() => {
    const count = celebrate ? 70 : 26;
    const celebrationColors = ['#f0a93a', '#ffe49b', '#4f8dff', '#eaf1fc'];
    const somberColors = ['#5a6b86', '#46566f', '#37445a'];
    const colors = celebrate ? celebrationColors : somberColors;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: -Math.random() * 8,
      dur: celebrate ? 4.5 + Math.random() * 4 : 7 + Math.random() * 5,
      size: celebrate ? 6 + Math.random() * 8 : 3 + Math.random() * 3,
      color: colors[i % colors.length],
      round: celebrate ? Math.random() > 0.6 : true,
      sway: (Math.random() - 0.5) * 40,
      opacity: celebrate ? 0.9 : 0.35,
    }));
  }, [celebrate]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {pieces.map(p => (
        <span key={p.id} style={{
          position: 'absolute', top: 0, left: `${p.left}%`,
          width: p.size, height: p.round ? p.size : p.size * 0.5,
          background: p.color, borderRadius: p.round ? '50%' : 2,
          marginLeft: p.sway, opacity: p.opacity,
          animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function VpChip({ chip, compact }: { chip: VpChip; compact?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: compact ? 4 : 6,
      padding: compact ? '4px 8px 4px 6px' : '5px 10px 5px 7px', borderRadius: 9,
      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hairline)',
    }}>
      {chip.icon && <Icon name={chip.icon} size={compact ? 12 : 15} color="var(--text-dim)" />}
      <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: 'var(--text-dim)' }}>
        {chip.count != null ? `${chip.count} ` : ''}{chip.label}
      </span>
      <span style={{ fontSize: compact ? 11 : 12, fontWeight: 800, color: 'var(--amber-soft)' }}>
        +{chip.vp}
      </span>
    </span>
  );
}

function StandingRow({ ranked, humanLost, isMobile }: {
  ranked: RankedPlayer;
  humanLost: boolean;
  isMobile: boolean;
}) {
  const { player, rank, breakdown, isHuman } = ranked;
  const color = PLAYER_COLORS[player.color as PlayerColor] || '#ccc';
  const isWinner = rank === 0;
  const medal = MEDAL_COLORS[rank] ?? 'var(--text-faint)';
  const markHuman = isHuman && humanLost;
  const isBot = !!player.agent_id && player.agent_id !== 'human';
  const displayVp = breakdown.reduce((sum, chip) => sum + chip.vp, 0) || player.victory_points;

  const rowBg = isWinner
    ? `linear-gradient(100deg, color-mix(in srgb, var(--amber) 16%, var(--glass-2)) 0%, var(--glass-2) 60%)`
    : markHuman
      ? `linear-gradient(100deg, color-mix(in srgb, ${color} 14%, var(--glass-2)) 0%, var(--glass-2) 60%)`
      : 'rgba(255,255,255,0.025)';

  if (isMobile) {
    return (
      <div style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden',
        padding: '12px 14px',
        background: rowBg,
        border: `1px solid ${isWinner ? 'var(--amber)' : markHuman ? color : 'var(--hairline)'}`,
        boxShadow: isWinner ? '0 10px 26px -10px var(--amber-glow)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        {isWinner && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay',
            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 48%, transparent 62%)',
            backgroundSize: '260% 100%', animation: 'winnerSheen 4.5s ease-in-out infinite',
          }} />
        )}
        {/* top row: rank + name + vp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center',
            fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14,
            background: isWinner ? 'linear-gradient(180deg,#ffe49b,#e9a32c)' : 'rgba(255,255,255,0.05)',
            color: isWinner ? '#3a2606' : medal,
            border: `1px solid ${isWinner ? '#b8791d' : 'var(--hairline)'}`,
          }}>
            {rank + 1}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
            {markHuman && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color, padding: '2px 5px', borderRadius: 4, background: `color-mix(in srgb, ${color} 18%, transparent)`, border: `1px solid ${color}`, flexShrink: 0 }}>YOU</span>
            )}
            <span style={{ marginLeft: 2, fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', flexShrink: 0 }}>
              {isBot ? (player.agent_id ?? 'Bot') : 'Human'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isWinner ? 26 : 20, lineHeight: 1, color: isWinner ? '#fff' : 'var(--text)' }}>
              {displayVp}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: isWinner ? 'var(--amber-soft)' : 'var(--text-faint)' }}>VP</span>
          </div>
        </div>
        {/* chips row */}
        {breakdown.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 38 }}>
            {breakdown.map((chip, i) => <VpChip key={i} chip={chip} compact />)}
          </div>
        )}
      </div>
    );
  }

  // Desktop / tablet layout (unchanged)
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 16,
      padding: isWinner ? '18px 20px' : '14px 20px',
      borderRadius: 14, overflow: 'hidden',
      background: rowBg,
      border: `1px solid ${isWinner ? 'var(--amber)' : markHuman ? color : 'var(--hairline)'}`,
      boxShadow: isWinner
        ? '0 12px 30px -10px var(--amber-glow), inset 0 1px 0 rgba(255,255,255,0.08)'
        : markHuman ? `0 10px 26px -12px ${color}` : 'none',
    }}>
      {isWinner && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay',
          background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 48%, transparent 62%)',
          backgroundSize: '260% 100%', animation: 'winnerSheen 4.5s ease-in-out infinite',
        }} />
      )}
      <div style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 10, display: 'grid', placeItems: 'center',
        fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 16,
        background: isWinner ? 'linear-gradient(180deg,#ffe49b,#e9a32c)' : 'rgba(255,255,255,0.05)',
        color: isWinner ? '#3a2606' : medal,
        border: `1px solid ${isWinner ? '#b8791d' : 'var(--hairline)'}`,
      }}>
        {rank + 1}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 128, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{player.name}</span>
          {markHuman && (
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', color, padding: '2px 6px', borderRadius: 5, background: `color-mix(in srgb, ${color} 18%, transparent)`, border: `1px solid ${color}` }}>YOU</span>
          )}
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          {isBot ? (player.agent_id ?? 'Bot') : 'Human'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
        {breakdown.map((chip, i) => <VpChip key={i} chip={chip} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0, paddingLeft: 6 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isWinner ? 42 : 34, lineHeight: 1, color: isWinner ? '#fff' : 'var(--text)' }}>
          {displayVp}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: isWinner ? 'var(--amber-soft)' : 'var(--text-faint)' }}>VP</span>
      </div>
    </div>
  );
}

export function GameOverScreen({ gameState, humanPlayerIndices, onPlayAgain, onMenu, onReplay, replayLoading }: Props) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const humanColorSet = useMemo(() => new Set(
    humanPlayerIndices.map(i => gameState.players[i]?.color)
  ), [gameState.players, humanPlayerIndices]);

  const ranked: RankedPlayer[] = useMemo(() => {
    return [...gameState.players]
      .map(player => {
        const breakdown = buildBreakdown(player);
        const displayVp = breakdown.reduce((s, c) => s + c.vp, 0) || player.victory_points;
        return { player, rank: 0, breakdown, isHuman: humanColorSet.has(player.color), displayVp };
      })
      .sort((a, b) => {
        const aIsWinner = a.player.color === gameState.winner;
        const bIsWinner = b.player.color === gameState.winner;
        if (aIsWinner !== bIsWinner) return aIsWinner ? -1 : 1;
        return b.displayVp - a.displayVp;
      })
      .map((r, i) => ({ ...r, rank: i }));
  }, [gameState.players, gameState.winner, humanColorSet]);

  const winner = ranked[0].player;
  const winnerColor = PLAYER_COLORS[winner.color as PlayerColor] || '#ccc';
  const humanRankedEntry = ranked.find(r => r.isHuman);
  const humanLost = !!(humanRankedEntry && humanRankedEntry.rank > 0);
  const isFullBotGame = humanPlayerIndices.length === 0;
  const celebrate = !humanLost;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', overflow: 'auto' }}>
      {/* backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(4,8,16,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      />

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: humanLost
          ? 'radial-gradient(620px 440px at 50% 16%, rgba(40,54,78,0.55), transparent 72%)'
          : `radial-gradient(620px 440px at 50% 16%, color-mix(in srgb, ${winnerColor} 22%, transparent), transparent 70%)`,
      }} />

      <Confetti celebrate={celebrate} />

      {/* card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 3,
          width: isMobile ? '100%' : 780,
          maxWidth: isMobile ? '100%' : '94vw',
          padding: isMobile ? '24px 14px 28px' : '44px 0 40px',
        }}
      >
        {/* winner crest */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: isMobile ? 18 : 28 }}>
          <span className="eyebrow" style={{
            color: humanLost ? '#8b9bb5' : 'var(--amber-soft)',
            letterSpacing: '0.34em', marginBottom: isMobile ? 10 : 16,
          }}>
            {isFullBotGame ? 'Game Over' : humanLost ? 'Defeat' : 'Victory'}
          </span>

          <Crown winnerColor={winnerColor} size={isMobile ? 64 : 92} />

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, marginTop: isMobile ? 10 : 14 }}>
            <span style={{ width: isMobile ? 12 : 16, height: isMobile ? 12 : 16, borderRadius: '50%', background: winnerColor, boxShadow: `0 0 16px ${winnerColor}` }} />
            <h1 style={{
              fontFamily: 'var(--ff-display)', fontWeight: 700,
              fontSize: isMobile ? 30 : 50,
              margin: 0, letterSpacing: '0.02em',
              background: 'linear-gradient(180deg,#fff,#d6e2f2)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>
              {winner.name} {winner.name === 'You' ? 'Win' : 'Wins'}
            </h1>
          </div>

          <p style={{ margin: `${isMobile ? 8 : 10}px 0 0`, fontSize: isMobile ? 13 : 15, fontWeight: 600, color: 'var(--text-dim)', textAlign: 'center' }}>
            {humanLost && humanRankedEntry ? (
              <span>
                You finished{' '}
                <span style={{ color: PLAYER_COLORS[humanRankedEntry.player.color as PlayerColor], fontWeight: 800 }}>
                  {ordinal(humanRankedEntry.rank + 1)}
                </span>{' '}
                of {gameState.players.length}
                <span style={{ color: 'var(--text-faint)' }}>
                  {' '}· {humanRankedEntry.breakdown.reduce((s, c) => s + c.vp, 0) || humanRankedEntry.player.victory_points} VP · {gameState.num_turns} turns
                </span>
              </span>
            ) : (
              <span>
                First to{' '}
                <span style={{ color: 'var(--amber-soft)', fontWeight: 800 }}>10 victory points</span>
                <span style={{ color: 'var(--text-faint)' }}> · {gameState.num_turns} turns</span>
              </span>
            )}
          </p>
        </div>

        {/* standings */}
        <div className="panel" style={{ padding: isMobile ? 10 : 16, display: 'flex', flexDirection: 'column', gap: isMobile ? 7 : 10 }}>
          <div className="eyebrow" style={{ padding: isMobile ? '2px 4px 2px' : '4px 6px 2px' }}>Final Standings</div>
          {ranked.map(r => (
            <StandingRow key={r.player.color} ranked={r} humanLost={humanLost} isMobile={isMobile} />
          ))}
        </div>

        {/* action buttons */}
        <div style={{
          display: 'flex', gap: isMobile ? 8 : 12,
          marginTop: isMobile ? 14 : 22,
          justifyContent: 'center',
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0 4px' : undefined,
        }}>
          <button onClick={onMenu} className="btn"
            style={{ padding: isMobile ? '13px 0' : '14px 26px', fontSize: isMobile ? 14 : 14.5, fontWeight: 700, fontFamily: 'var(--ff-display)', letterSpacing: '0.04em' }}>
            Main Menu
          </button>
          <button
            onClick={onReplay}
            disabled={replayLoading}
            className="btn"
            style={{ padding: isMobile ? '13px 0' : '14px 26px', fontSize: isMobile ? 14 : 14.5, fontWeight: 700, fontFamily: 'var(--ff-display)', letterSpacing: '0.04em', borderColor: 'rgba(160,130,235,0.4)', color: '#c4b5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: replayLoading ? 0.7 : 1 }}
          >
            {replayLoading ? (
              <>
                <span style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid #c4b5f5', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                Loading…
              </>
            ) : '📼 Replay'}
          </button>
          <button onClick={onPlayAgain} className="btn btn-primary"
            style={{ padding: isMobile ? '13px 0' : '14px 32px', fontSize: isMobile ? 14 : 14.5, fontWeight: 700, fontFamily: 'var(--ff-display)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="dice" size={17} color="#fff" />
            {humanLost ? 'Rematch' : 'Play Again'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
