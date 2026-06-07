import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useBackgroundMusic } from '@/shared/hooks/useBackgroundMusic';
import { useUiStore } from '@/store/uiStore';
import type { Breakpoint } from '@/shared/hooks/useBreakpoint';
import { getAgents } from '@/services/api/agentsApi';
import { createGame } from '@/services/api/gamesApi';
import { useGameStore } from '@/store/gameStore';
import { Icon } from '@/shared/components/Icon';
import { HexGridBackground } from '@/shared/components/HexGridBackground';
import { VideoBackground } from '@/shared/components/VideoBackground';
import type { AgentConfig } from '@/shared/types/api';
import { PLAYER_COLORS, PLAYER_COLOR_BY_INDEX, PLAYER_COUNT_OPTIONS } from '@/shared/constants';

interface PlayerSlot { agentId: string }

// ── Strategy tips ────────────────────────────────────────────────────────────

const STRATEGY_TIPS = [
  'Ore + Wheat is the strongest late-game combo — settle on high-probability tiles.',
  'Longest Road is worth 2 VP, but only claim it if you can actually hold it.',
  'In 3-player games ports become critical — resource scarcity hits much harder.',
  'Never let the leader reach 8 VP without using your knight.',
  'First-round settlement placement defines your entire game — plan two rounds ahead.',
  '3:1 ports are underrated — they let any surplus resource count.',
  'Cities beat new settlements on every turn after the first city upgrade.',
  'Use the robber to block the player in second place, not last.',
  'Rolling 6 and 8 tiles are statistically the most valuable — prioritise them.',
  'Buy a dev card early — the added flexibility is worth more than one resource.',
  'Brick + Wood wins early, Ore + Wheat wins late — know when to pivot.',
  'Never trade a resource to someone who is already winning.',
];

function StrategyTip() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * STRATEGY_TIPS.length));
  const [show, setShow] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % STRATEGY_TIPS.length); setShow(true); }, 380);
    }, 5200);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
      <AnimatePresence mode="wait">
        {show && (
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.32 }}
            style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)', fontWeight: 500, lineHeight: 1.45, textAlign: 'center' }}
          >
            <span style={{ color: 'var(--amber-soft)', fontWeight: 700 }}>Tip · </span>
            {STRATEGY_TIPS[idx]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Bot personas ─────────────────────────────────────────────────────────────

interface BotPersona {
  codename: string;
  tagline: string;
  fallbackDesc: string;
  style: string;
  aggression: number; // 1-5
  economy: number;    // 1-5
  avatarFrom: string;
  avatarTo: string;
  // Drop the generated image into public/assets/bots/<image> and it appears automatically
  image: string;
  imagePrompt: string;
}

const PERSONAS: BotPersona[] = [
  {
    codename: 'The Architect',
    tagline: 'Reinforcement-learned dominance',
    fallbackDesc: 'Trained through millions of self-play games. Adapts to any board state and exploits positional advantages with cold precision.',
    style: 'Adaptive',
    aggression: 5, economy: 4,
    avatarFrom: '#0f2a6e', avatarTo: '#1e40af',
    image: '/assets/bots/Architect.png',
    imagePrompt: 'Portrait of a faceless entity in dark angular armor covered with glowing blue hexagonal circuit patterns, floating hex game tiles surrounding it, electric blue and dark navy palette, dramatic rim lighting, ultra detailed digital concept art, cinematic, 3:4',
  },
  {
    codename: 'The Tactician',
    tagline: 'Calculated positional control',
    fallbackDesc: 'A neural-network planner that builds multi-turn sequences. Excels at blocking opponents and securing high-value tile clusters.',
    style: 'Positional',
    aggression: 4, economy: 3,
    avatarFrom: '#1a3a2a', avatarTo: '#166534',
    image: '/assets/bots/Tactician.png',
    imagePrompt: 'Portrait of a shadowy hooded military commander with piercing amber eyes, dark tactical gear, subtle hex pattern engravings on shoulder armour, holographic hex battle-map behind, deep teal and amber palette, dramatic side lighting, ultra detailed concept art, 3:4',
  },
  {
    codename: 'The Veteran',
    tagline: 'Battle-hardened settler instincts',
    fallbackDesc: 'Decades of simulated play crystallised into sharp heuristics. Steady resource engine, punishes expansion mistakes ruthlessly.',
    style: 'Aggressive',
    aggression: 4, economy: 4,
    avatarFrom: '#3d1a08', avatarTo: '#92400e',
    image: '/assets/bots/Veteran.png',
    imagePrompt: 'Portrait of a weathered sea merchant captain with grey-streaked hair and sharp eyes, worn leather coat with bronze hex token clasps, glowing resource cards floating around them, warm orange and deep brown palette, tavern candlelight, confident smirk, detailed portrait, 3:4',
  },
  {
    codename: 'The Merchant',
    tagline: 'Trade routes and resource flows',
    fallbackDesc: 'Port-focused and patient. Exploits trade ratios to convert surplus into wins. Underestimated until it\'s too late.',
    style: 'Economic',
    aggression: 2, economy: 5,
    avatarFrom: '#2d1a5c', avatarTo: '#5b21b6',
    image: '/assets/bots/Merchant.png',
    imagePrompt: 'Portrait of a cunning alchemist with rounded spectacles and dark purple robes with gold hex symbols, floating glowing trade tokens and resource crystals, mysterious knowing smile, purple and gold palette, arcane laboratory background with hex patterns, detailed digital painting, 3:4',
  },
  {
    codename: 'The Apprentice',
    tagline: 'Learning the board, one turn at a time',
    fallbackDesc: 'A developing agent still finding its voice. Predictable enough to beat, but capable of surprising plays when corners are cut.',
    style: 'Defensive',
    aggression: 1, economy: 3,
    avatarFrom: '#0a2e1a', avatarTo: '#065f46',
    image: '/assets/bots/Apprentice.png',
    imagePrompt: 'Portrait of an eager young settler with bright hopeful eyes, simple adventurer\'s clothing with a small hex badge, holding colourful resource cards, soft green and teal palette, warm natural lighting, forest clearing background, enthusiastic expression, clean digital illustration, 3:4',
  },
];

function getPersona(rankAmongBots: number, totalBots: number): BotPersona {
  const pct = totalBots <= 1 ? 0 : rankAmongBots / (totalBots - 1);
  if (pct < 0.20) return PERSONAS[0];
  if (pct < 0.40) return PERSONAS[1];
  if (pct < 0.60) return PERSONAS[2];
  if (pct < 0.80) return PERSONAS[3];
  return PERSONAS[4];
}

// ── Strength level helper ────────────────────────────────────────────────────

function getStrengthLevel(agentId: string, allAgents: AgentConfig[]): number {
  if (!agentId || agentId === 'human') return 0;
  const bots = allAgents.filter(a => a.agent_id !== 'human');
  const sorted = [...bots].sort((a, b) => (b.selection_priority ?? 0) - (a.selection_priority ?? 0));
  const rank = sorted.findIndex(a => a.agent_id === agentId);
  if (rank === -1 || sorted.length === 0) return 3;
  return Math.max(1, Math.min(5, Math.round(1 + (rank / Math.max(sorted.length - 1, 1)) * 4)));
}


// ── Bot picker modal ─────────────────────────────────────────────────────────

interface BotPickerModalProps {
  agents: AgentConfig[];
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function StatBar({ label, value, max = 5, accent }: { label: string; value: number; max?: number; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-faint)', width: 72, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 2, background: accent }}
        />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, width: 24, textAlign: 'right' }}>{value}/{max}</span>
    </div>
  );
}

function BotPickerModal({ agents, currentId, onSelect, onClose }: BotPickerModalProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const bots = agents.filter(a => a.agent_id !== 'human');
  const sortedBots = [...bots].sort((a, b) => (b.selection_priority ?? 0) - (a.selection_priority ?? 0));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="panel"
        style={{
          position: 'relative', zIndex: 1,
          width: isMobile ? '94vw' : isTablet ? '90vw' : 640,
          maxWidth: '96vw', maxHeight: '88vh', overflowY: 'auto',
          padding: isMobile ? '16px 14px 16px' : '24px 22px 20px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 5 }}>Select AI opponent</div>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 20, letterSpacing: '0.04em' }}>Choose Bot</div>
          </div>
          <button onClick={onClose} className="btn" style={{ width: 34, height: 34, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="close" size={15} color="var(--text-dim)" />
          </button>
        </div>

        {/* Bot grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? 10 : 12,
        }}>
          {sortedBots.map((bot, rankIdx) => {
            const persona = getPersona(rankIdx, sortedBots.length);
            const strength = getStrengthLevel(bot.agent_id, agents);
            const isSelected = bot.agent_id === currentId;
            const desc = bot.description || persona.fallbackDesc;
            const cardHeight = isMobile ? 160 : isTablet ? 210 : 240;

            return isMobile ? (
              // ── Mobile: horizontal card (image left, content right) ──────
              <motion.button
                key={bot.agent_id}
                onClick={() => { onSelect(bot.agent_id); onClose(); }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rankIdx * 0.04 }}
                style={{
                  textAlign: 'left', borderRadius: 14, padding: 0,
                  border: `1.5px solid ${isSelected ? persona.avatarTo : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isSelected ? `0 0 20px -8px ${persona.avatarTo}70` : 'none',
                  cursor: 'pointer', overflow: 'hidden',
                  background: `linear-gradient(145deg, ${persona.avatarFrom}, ${persona.avatarTo})`,
                  display: 'flex', height: 124,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                {/* Image strip on left */}
                <div style={{ width: 88, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={persona.image}
                    alt={persona.codename}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to right, transparent 50%, rgba(8,16,30,0.85))',
                  }} />
                </div>

                {/* Content on right */}
                <div style={{ flex: 1, minWidth: 0, padding: '11px 12px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 4, position: 'relative', background: 'rgba(0,0,0,0.28)' }}>
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: persona.avatarTo, display: 'grid', placeItems: 'center' }}>
                      <Icon name="check" size={11} color="#fff" />
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14.5, color: '#fff', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {persona.codename}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bot.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                    <StatBar label="Aggression" value={persona.aggression} accent={persona.avatarTo} />
                    <StatBar label="Strength"   value={strength} max={5}   accent={persona.avatarTo} />
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', padding: '1px 6px', borderRadius: 4, background: `color-mix(in srgb, ${persona.avatarTo} 25%, rgba(0,0,0,0.4))`, border: `1px solid color-mix(in srgb, ${persona.avatarTo} 50%, transparent)`, color: persona.avatarTo }}>
                      {persona.style.toUpperCase()}
                    </span>
                  </div>
                </div>
              </motion.button>
            ) : (
              // ── Tablet / Desktop: full-bleed vertical card ───────────────
              <motion.button
                key={bot.agent_id}
                onClick={() => { onSelect(bot.agent_id); onClose(); }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: rankIdx * 0.04 }}
                style={{
                  textAlign: 'left', borderRadius: 14, padding: 0,
                  border: `1.5px solid ${isSelected ? persona.avatarTo : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isSelected ? `0 0 28px -8px ${persona.avatarTo}70` : 'none',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  height: cardHeight,
                  background: `linear-gradient(145deg, ${persona.avatarFrom}, ${persona.avatarTo})`,
                  display: 'flex', flexDirection: 'column',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <img
                  src={persona.image}
                  alt={persona.codename}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(8,16,30,0.08) 0%, rgba(8,16,30,0.45) 45%, rgba(8,16,30,0.97) 72%)' }} />
                {isSelected && (
                  <>
                    <div style={{ position: 'absolute', inset: 0, background: `color-mix(in srgb, ${persona.avatarTo} 12%, transparent)`, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', background: persona.avatarTo, display: 'grid', placeItems: 'center', boxShadow: `0 0 10px ${persona.avatarTo}` }}>
                      <Icon name="check" size={13} color="#fff" />
                    </div>
                  </>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isTablet ? '0 12px 12px' : '0 14px 14px' }}>
                  <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isTablet ? 14 : 15, color: '#fff', marginBottom: 3, letterSpacing: '0.02em' }}>
                    {persona.codename}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: isTablet ? 6 : 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bot.name}
                  </div>
                  {!isTablet && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500, lineHeight: 1.45, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {desc}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <StatBar label="Aggression" value={persona.aggression} accent={persona.avatarTo} />
                    {!isTablet && <StatBar label="Economy" value={persona.economy} accent={persona.avatarTo} />}
                    <StatBar label="Strength"   value={strength} max={5}   accent={persona.avatarTo} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: isTablet ? 7 : 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 4, background: `color-mix(in srgb, ${persona.avatarTo} 25%, rgba(0,0,0,0.4))`, border: `1px solid color-mix(in srgb, ${persona.avatarTo} 50%, transparent)`, color: persona.avatarTo }}>{persona.style.toUpperCase()}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' }}>STR {strength}/5</span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

// ── Horizontal player card ───────────────────────────────────────────────────

interface PlayerCardProps {
  colorKey: string;
  index: number;
  slot: PlayerSlot;
  agents: AgentConfig[];
  isHuman: boolean;
  agentsLoading: boolean;
  bp: Breakpoint;
  onChangBot: () => void;
}

function PlayerCard({ colorKey, index, slot, agents, isHuman, agentsLoading, bp, onChangBot }: PlayerCardProps) {
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const hex = PLAYER_COLORS[colorKey as keyof typeof PLAYER_COLORS] || '#ccc';
  const bots = agents.filter(a => a.agent_id !== 'human');
  const sortedBots = [...bots].sort((a, b) => (b.selection_priority ?? 0) - (a.selection_priority ?? 0));
  const rankIdx = sortedBots.findIndex(b => b.agent_id === slot.agentId);
  const persona = rankIdx >= 0 ? getPersona(rankIdx, sortedBots.length) : null;
  const strength = getStrengthLevel(slot.agentId, agents);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        flex: 1, minWidth: 0,
        position: 'relative', overflow: 'hidden',
        borderRadius: isMobile ? 14 : 16,
        minHeight: isMobile ? 158 : isTablet ? 174 : 190,
        background: isHuman
          ? `color-mix(in srgb, ${hex} 28%, #0d2244)`
          : persona
            ? `linear-gradient(145deg, ${persona.avatarFrom}, ${persona.avatarTo})`
            : `color-mix(in srgb, ${hex} 28%, #0d2244)`,
        border: `1px solid color-mix(in srgb, ${hex} 30%, rgba(125,165,225,0.14))`,
        boxShadow: isHuman ? `0 0 22px -8px ${hex}50` : 'none',
      }}
    >
      {/* Full-bleed bot image */}
      {!isHuman && persona && (
        <img
          src={persona.image}
          alt={persona.codename}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
      )}

      {/* Human: centred icon */}
      {isHuman && (
        <div style={{ position: 'absolute', top: '18%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 52, height: 52,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: `color-mix(in srgb, ${hex} 55%, #0d2244)`,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name="user" size={24} color="rgba(255,255,255,0.92)" strokeWidth={1.8} />
          </div>
        </div>
      )}

      {/* Gradient overlay — heavier at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isHuman
          ? `linear-gradient(to bottom, color-mix(in srgb, ${hex} 10%, transparent) 0%, rgba(8,16,30,0.88) 70%)`
          : 'linear-gradient(to bottom, rgba(8,16,30,0.04) 20%, rgba(8,16,30,0.60) 55%, rgba(8,16,30,0.97) 80%)',
      }} />

      {/* Content pinned to bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: isMobile ? '0 8px 10px' : '0 10px 13px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 4 : 5,
      }}>
        {/* Color label */}
        <div style={{ fontSize: isMobile ? 7.5 : 8.5, fontWeight: 800, letterSpacing: '0.14em', color: hex, textTransform: 'uppercase', textAlign: 'center' }}>
          {colorKey} · P{index + 1}
        </div>

        {/* Name */}
        <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>
          {isHuman ? 'You' : agentsLoading ? '…' : (persona?.codename ?? '—')}
        </div>

        {/* Badge */}
        {isHuman ? (
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', color: hex, opacity: 0.8 }}>HUMAN</span>
        ) : persona ? (
          <span style={{
            fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em',
            padding: '2px 6px', borderRadius: 4,
            background: `color-mix(in srgb, ${persona.avatarTo} 22%, rgba(0,0,0,0.35))`,
            border: `1px solid color-mix(in srgb, ${persona.avatarTo} 45%, transparent)`,
            color: persona.avatarTo,
          }}>{persona.style.toUpperCase()}</span>
        ) : null}

        {/* Strength dots */}
        {!isHuman && !agentsLoading && (
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: 5 }, (_, d) => (
              <div key={d} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: d < strength ? hex : 'rgba(255,255,255,0.15)',
                boxShadow: d < strength ? `0 0 4px ${hex}` : 'none',
              }} />
            ))}
          </div>
        )}

        {/* Change button */}
        {!isHuman && (
          <button
            onClick={onChangBot}
            className="btn"
            style={{
              width: '100%', marginTop: 2, padding: '7px 0',
              fontSize: 11, fontWeight: 700, borderRadius: 9,
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            Change
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main lobby page ──────────────────────────────────────────────────────────

export default function LobbyPage() {
  useBackgroundMusic();
  const navigate     = useNavigate();
  const muted        = useUiStore(s => s.muted);
  const toggleMuted  = useUiStore(s => s.toggleMuted);
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const resetGame  = useGameStore(s => s.reset);
  const setGameId  = useGameStore(s => s.setGameId);
  const addLog     = useGameStore(s => s.addLog);

  const [numPlayers, setNumPlayers]       = useState<2 | 3 | 4>(4);
  const [slots, setSlots]                 = useState<PlayerSlot[]>([
    { agentId: 'human' }, { agentId: '' }, { agentId: '' }, { agentId: '' },
  ]);
  const [agents, setAgents]               = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError]     = useState<string | null>(null);
  const [friendlyRobber, setFriendlyRobber] = useState(false);
  const [mapSeed, setMapSeed]             = useState('');
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState<string | null>(null);
  const [pickerSlot, setPickerSlot]       = useState<number | null>(null);

  const loadAgents = useCallback(async (count: number) => {
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const list   = await getAgents(count);
      const sorted = [...list].sort((a, b) => (b.selection_priority || 0) - (a.selection_priority || 0));
      setAgents(sorted);
      const botAgents = sorted.filter(a => a.agent_id !== 'human');
      const randBot = () => botAgents[Math.floor(Math.random() * botAgents.length)]?.agent_id || 'arch-expert-rl';
      const validIds = new Set(sorted.map(a => a.agent_id));
      setSlots(prev => prev.map((s, i) => {
        if (i === 0) return { agentId: 'human' };
        // Keep existing pick only if it exists in the newly loaded agent list
        const keep = s.agentId && validIds.has(s.agentId) && s.agentId !== 'human';
        return { agentId: keep ? s.agentId : randBot() };
      }));
    } catch (e) {
      setAgentsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAgents(numPlayers); }, [numPlayers, loadAgents]);

  const handleNumPlayersChange = (n: 2 | 3 | 4) => {
    setNumPlayers(n);
    setSlots(prev => {
      const extended = [...prev];
      while (extended.length < n) extended.push({ agentId: '' });
      return extended.slice(0, n);
    });
  };

  const handleStartGame = async () => {
    setCreating(true);
    setCreateError(null);
    resetGame();
    try {
      const playerIds = slots.slice(0, numPlayers).map(s => s.agentId || 'arch-expert-rl');
      const session   = await createGame({
        num_players: numPlayers,
        player_ids: playerIds,
        recording: true,
        config: { friendly_robber: friendlyRobber },
        ...(mapSeed ? { map_seed: parseInt(mapSeed) } : {}),
      });
      setGameId(session.game_id);
      addLog(`Game created (${session.game_id.slice(0, 8)}…)`, 'success');
      navigate('/game');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const activeColors = Array.from({ length: numPlayers }, (_, i) => PLAYER_COLOR_BY_INDEX[i]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: isMobile ? 'block' : 'grid',
      placeItems: isMobile ? undefined : 'center',
      overflowY: 'auto',
      background: `
        radial-gradient(ellipse 110% 55% at 50% -5%, #16314f 0%, transparent 60%),
        radial-gradient(ellipse 70% 45% at 15% 100%, #102a47 0%, transparent 55%),
        radial-gradient(ellipse 70% 45% at 85% 100%, #102a47 0%, transparent 55%),
        linear-gradient(180deg, #0a1626 0%, #060b15 100%)
      `,
    }}>
      <VideoBackground />
      <HexGridBackground />

      {/* sapphire centre glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 55% 45% at 50% 30%, rgba(47,116,240,0.13), transparent 70%)',
      }} />

      {/* back button */}
      <button
        onClick={() => navigate('/')}
        className="btn"
        style={{
          position: 'absolute', top: isMobile ? 14 : 22, left: isMobile ? 16 : 28, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 14px', borderRadius: 999,
          fontSize: 13, fontWeight: 700, color: 'var(--text-dim)',
        }}
      >
        <Icon name="arrow-left" size={15} color="var(--text-dim)" />
        Home
      </button>

      {/* mute toggle */}
      <button
        onClick={toggleMuted}
        className="btn"
        title={muted ? 'Unmute' : 'Mute'}
        style={{
          position: 'absolute', top: isMobile ? 14 : 22, right: isMobile ? 16 : 28, zIndex: 10,
          width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, padding: 0,
          borderRadius: 999, display: 'grid', placeItems: 'center',
        }}
      >
        <Icon name={muted ? 'volume-x' : 'volume'} size={isMobile ? 17 : 19} color={muted ? 'var(--text-ghost)' : 'var(--text-dim)'} />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 1, width: isMobile ? '100%' : isTablet ? '92vw' : 580, maxWidth: '100%', padding: isMobile ? '60px 0 40px' : '64px 0 40px', boxSizing: 'border-box' }}
      >
        {/* ── Crest + Title ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: isMobile ? 20 : 28 }}>
          <div style={{ position: 'relative', width: isMobile ? 56 : 68, height: isMobile ? 62 : 76, marginBottom: isMobile ? 10 : 12 }}>
            <svg width={isMobile ? 56 : 68} height={isMobile ? 62 : 76} viewBox="0 0 78 86"
              style={{ filter: 'drop-shadow(0 8px 22px rgba(47,116,240,0.45))' }}>
              <path d="M39 2L73 21V64L39 84L5 64V21Z" fill="url(#crestg2)" stroke="var(--amber)" strokeWidth="2" />
              <defs>
                <linearGradient id="crestg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1f3f70" />
                  <stop offset="1" stopColor="#0d2244" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <svg width={isMobile ? 24 : 30} height={isMobile ? 24 : 30} viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#eef3fb" />
                <circle cx="8" cy="8" r="1.6" fill="#0e2244" />
                <circle cx="16" cy="16" r="1.6" fill="#0e2244" />
                <circle cx="12" cy="12" r="1.6" fill="var(--p-red)" />
                <circle cx="16" cy="8" r="1.6" fill="#0e2244" />
                <circle cx="8" cy="16" r="1.6" fill="#0e2244" />
              </svg>
            </div>
          </div>

          <h1 style={{
            fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: isMobile ? 32 : 46,
            margin: 0, letterSpacing: '0.04em',
            background: 'linear-gradient(180deg,#fff,#bcd0ee)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>HEXBANDIT</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ height: 1, width: 28, background: 'var(--amber)', opacity: 0.6 }} />
            <span className="eyebrow" style={{ color: 'var(--amber-soft)', letterSpacing: '0.32em' }}>Catan AI Engine</span>
            <span style={{ height: 1, width: 28, background: 'var(--amber)', opacity: 0.6 }} />
          </div>
        </div>

        {/* ── Config panel ── */}
        <div className="panel" style={{ padding: isMobile ? 18 : 26, margin: isMobile ? '0 12px' : undefined, boxSizing: 'border-box' }}>

          {/* Player count */}
          <div className="eyebrow" style={{ marginBottom: 12 }}>Players</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 8 : 10, marginBottom: 24 }}>
            {PLAYER_COUNT_OPTIONS.map(n => {
              const on = numPlayers === n;
              return (
                <button key={n} onClick={() => handleNumPlayersChange(n)} className="btn"
                  style={{
                    padding: isMobile ? '12px 0' : '15px 0', fontSize: isMobile ? 14 : 16,
                    fontFamily: 'var(--ff-display)', letterSpacing: '0.04em',
                    background: on
                      ? 'linear-gradient(180deg,var(--sapphire-bright),var(--sapphire))'
                      : 'var(--glass-hi)',
                    borderColor: on ? 'rgba(255,255,255,0.2)' : 'var(--glass-brd)',
                    boxShadow: on
                      ? '0 8px 24px -6px var(--sapphire-glow), 0 1px 0 rgba(255,255,255,0.25) inset'
                      : 'none',
                  }}>
                  {n}&nbsp;Players
                </button>
              );
            })}
          </div>

          {/* Horizontal player cards */}
          <div className="eyebrow" style={{ marginBottom: 14 }}>Player Setup</div>

          {agentsError ? (
            <div style={{
              fontSize: 12.5, color: '#f87171',
              background: 'rgba(220,50,50,0.07)', border: '1px solid rgba(220,50,50,0.18)',
              borderRadius: 10, padding: '11px 14px', marginBottom: 4,
            }}>
              Failed to load agents: {agentsError}
              <button onClick={() => loadAgents(numPlayers)}
                style={{ marginLeft: 10, color: 'var(--sapphire-bright)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--ff-ui)' }}>
                Retry
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${numPlayers}, 1fr)`,
              gap: isMobile ? 8 : isTablet ? 9 : 10,
              marginBottom: 22,
            }}>
              {activeColors.map((colorKey, i) => (
                <PlayerCard
                  key={colorKey}
                  colorKey={colorKey}
                  index={i}
                  slot={slots[i] || { agentId: '' }}
                  agents={agents}
                  isHuman={i === 0}
                  agentsLoading={agentsLoading}
                  bp={bp}
                  onChangBot={() => setPickerSlot(i)}
                />
              ))}
            </div>
          )}

          {/* Options row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <span
                onClick={() => setFriendlyRobber(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                  background: friendlyRobber ? 'var(--sapphire)' : 'var(--bg-1)',
                  border: `1.5px solid ${friendlyRobber ? 'var(--sapphire-bright)' : 'var(--glass-brd)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  boxShadow: friendlyRobber ? '0 0 8px var(--sapphire-glow)' : 'none',
                }}
              >
                {friendlyRobber && (
                  <svg width="10" height="8" viewBox="0 0 10 8">
                    <polyline points="1,4 4,7 9,1" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Friendly Robber</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>Map Seed</span>
              <input
                type="number"
                value={mapSeed}
                onChange={e => setMapSeed(e.target.value)}
                placeholder="random"
                style={{
                  width: 90, background: 'var(--bg-1)', border: '1px solid var(--glass-brd)',
                  borderRadius: 8, padding: '6px 10px', fontSize: 12.5,
                  color: 'var(--text)', outline: 'none', fontFamily: 'var(--ff-ui)',
                }}
              />
            </div>
          </div>

          {/* Strategy tip */}
          <div style={{
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            background: 'rgba(240,169,58,0.06)', border: '1px solid rgba(240,169,58,0.15)',
          }}>
            <StrategyTip />
          </div>

          {/* Error */}
          {createError && (
            <div style={{
              marginBottom: 12, fontSize: 12.5, color: '#f87171',
              background: 'rgba(220,50,50,0.07)', border: '1px solid rgba(220,50,50,0.18)',
              borderRadius: 10, padding: '11px 14px',
            }}>
              {createError}
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStartGame}
            disabled={creating || agentsLoading}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '16px 0', fontSize: 17,
              fontFamily: 'var(--ff-display)', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {creating ? (
              <>
                <span style={{ width: 17, height: 17, flexShrink: 0, border: '2px solid rgba(255,255,255,0.25)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Creating…
              </>
            ) : (
              <>
                <Icon name="play" size={18} color="#fff" />
                Start Game
              </>
            )}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-ghost)', fontWeight: 600, letterSpacing: '0.04em' }}>
          Powered by Hexbandit&nbsp;API · staging-api.hexbandit.io
        </div>
      </motion.div>

      {/* Bot picker modal */}
      <AnimatePresence>
        {pickerSlot !== null && pickerSlot > 0 && (
          <BotPickerModal
            agents={agents}
            currentId={slots[pickerSlot]?.agentId || ''}
            onSelect={id => setSlots(prev => prev.map((s, i) => i === pickerSlot ? { agentId: id } : s))}
            onClose={() => setPickerSlot(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
