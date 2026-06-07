import { PLAYER_COLORS, RESOURCE_EMOJI, RESOURCE_ORDER } from '@/shared/constants';
import type { ActionLogEvent, Player } from '@/shared/types/game';

const RESOURCE_IDX_EMOJI = ['🪵', '🧱', '🐑', '🌾', '⛏️'];
const DEV_CARD_ICONS = ['⚔️ Knight', '🎁 Year of Plenty', '💰 Monopoly', '🛤️ Road Building', '🏆 Victory Point'];

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function playerLabel(color: string, players: Player[]): string {
  const p = players.find(pl => pl.color === color);
  const name = escHtml(p?.name ?? color);
  const hex = PLAYER_COLORS[color as keyof typeof PLAYER_COLORS] ?? '#ccc';
  return `<span style="color:${hex};font-weight:700;">${name}</span>`;
}

function resEmoji(idx: number): string {
  return RESOURCE_IDX_EMOJI[idx] ?? '?';
}

function resStr(idx: number, count: number): string {
  const emoji = resEmoji(idx);
  return count >= 2 ? `${emoji}×${count}` : emoji;
}

function formatRollPayout(result: unknown, players: Player[]): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  const parts: string[] = [];
  for (const [color, freqdeck] of Object.entries(result as Record<string, unknown>)) {
    if (!Array.isArray(freqdeck)) continue;
    const gains = (freqdeck as number[])
      .map((count, idx) => count > 0 ? resStr(idx, count) : '')
      .filter(Boolean);
    if (gains.length === 0) continue;
    parts.push(`${playerLabel(color, players)} ${gains.join(' ')}`);
  }
  return parts.length > 0 ? ` — ${parts.join('; ')}` : '';
}

/** Format a single action log event into an HTML string for the game log. Returns null to suppress. */
export function formatActionLogEvent(event: ActionLogEvent, players: Player[]): string | null {
  const { action_type: type, color, value: val, result } = event;
  const label = playerLabel(color, players);

  switch (type) {
    case 'ROLL': {
      const dice = Array.isArray(val) && val.length === 2
        ? val as [number, number]
        : Array.isArray(result) && (result as unknown[]).length === 2
          ? result as [number, number]
          : null;
      const d1 = dice ? dice[0] : '?';
      const d2 = dice ? dice[1] : '?';
      const total = dice ? (d1 as number) + (d2 as number) : '?';
      return `${label}: 🎲 ROLL <b>${total}</b> (${d1}+${d2})${formatRollPayout(result, players)}`;
    }
    case 'BUILD_SETTLEMENT':
      return `${label}: 🏠 BUILD SETTLEMENT`;
    case 'BUILD_CITY':
      return `${label}: 🏰 BUILD CITY`;
    case 'BUILD_ROAD':
      return `${label}: 🛤️ BUILD ROAD`;
    case 'BUY_DEVELOPMENT_CARD': {
      if (result !== null && result !== undefined) {
        const cardName = DEV_CARD_ICONS[result as number] ?? `card #${result}`;
        return `${label}: 📜 BUY DEV CARD [${cardName}]`;
      }
      return `${label}: 📜 BUY DEV CARD`;
    }
    case 'PLAY_KNIGHT_CARD':
      return `${label}: ⚔️ PLAY KNIGHT`;
    case 'MOVE_ROBBER': {
      let msg = `${label}: 🥷 MOVE ROBBER`;
      if (Array.isArray(val) && val.length >= 2 && val[1]) {
        msg += ` → rob ${playerLabel(String(val[1]), players)}`;
      }
      if (event.card_stolen) {
        msg += result !== null && result !== undefined
          ? ` — stole ${RESOURCE_IDX_EMOJI[result as number] ?? '?'}`
          : ' — stole a card';
      }
      return msg;
    }
    case 'MARITIME_TRADE': {
      if (Array.isArray(val)) {
        const asking = val[val.length - 1] as number;
        const giving = (val.slice(0, -1) as number[]).filter(v => v !== null);
        const rate = giving.length;
        return `${label}: ⚓ TRADE ${rate}:1 ${RESOURCE_IDX_EMOJI[giving[0]] ?? '?'} → ${RESOURCE_IDX_EMOJI[asking] ?? '?'}`;
      }
      return `${label}: ⚓ MARITIME TRADE`;
    }
    case 'DISCARD': {
      if (Array.isArray(val)) {
          const parts = (val as number[]).map(r => RESOURCE_IDX_EMOJI[r] ?? '?').join(' ');
        return `${label}: 🗑️ DISCARD ${parts}`;
      }
      return `${label}: 🗑️ DISCARD`;
    }
    case 'PLAY_YEAR_OF_PLENTY': {
      if (Array.isArray(val)) {
        const gained = (val as number[]).map(r => RESOURCE_IDX_EMOJI[r] ?? '?').join(' ');
        return `${label}: 🎁 YEAR OF PLENTY — ${gained}`;
      }
      return `${label}: 🎁 YEAR OF PLENTY`;
    }
    case 'PLAY_MONOPOLY': {
      const emoji = RESOURCE_IDX_EMOJI[val as number] ?? RESOURCE_EMOJI[RESOURCE_ORDER[val as number]];
      return `${label}: 💰 MONOPOLY on ${emoji ?? '?'}`;
    }
    case 'PLAY_ROAD_BUILDING':
      return `${label}: 🛤️ ROAD BUILDING`;
    case 'OFFER_TRADE': {
      if (Array.isArray(val) && (val as unknown[]).length >= 10) {
        const offering = (val as number[]).slice(0, 5);
        const asking = (val as number[]).slice(5, 10);
        const offerParts = offering.map((n, i) => n > 0 ? resStr(i, n) : '').filter(Boolean);
        const askParts = asking.map((n, i) => n > 0 ? resStr(i, n) : '').filter(Boolean);
        return `${label}: 🤝 OFFER ${offerParts.join(' ')} → ${askParts.join(' ')}`;
      }
      return `${label}: 🤝 OFFER TRADE`;
    }
    case 'ACCEPT_TRADE':
      return `${label}: ✅ ACCEPT TRADE`;
    case 'REJECT_TRADE':
      return `${label}: ❌ REJECT TRADE`;
    case 'CONFIRM_TRADE':
      return `${label}: 🤝 CONFIRM TRADE`;
    case 'CANCEL_TRADE':
      return `${label}: 🚫 CANCEL TRADE`;
    case 'END_TURN':
      return null;
    default:
      return `${label}: ${escHtml(type)}`;
  }
}

/** Extract [d1, d2] from a ROLL action log event's value field. */
export function extractRollDice(event: ActionLogEvent): [number, number] | null {
  const val = event.value;
  if (Array.isArray(val) && val.length === 2 &&
      typeof val[0] === 'number' && typeof val[1] === 'number') {
    return [val[0], val[1]];
  }
  return null;
}

/** Extract resource gains per player color from a ROLL event's result field.
 *  result shape: { COLOR: [wood, brick, sheep, wheat, ore] } (freqdeck)
 *  Returns: { COLOR: { wood: N, ... } } — only non-zero entries.
 */
export function extractRollGains(event: ActionLogEvent): Record<string, Partial<Record<string, number>>> | null {
  const result = event.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;

  const gains: Record<string, Partial<Record<string, number>>> = {};
  for (const [color, freqdeck] of Object.entries(result as Record<string, unknown>)) {
    if (!Array.isArray(freqdeck)) continue;
    const colorGains: Partial<Record<string, number>> = {};
    RESOURCE_ORDER.forEach((res, idx) => {
      const count = (freqdeck as number[])[idx];
      if (count > 0) colorGains[res] = count;
    });
    if (Object.keys(colorGains).length > 0) gains[color] = colorGains;
  }
  return Object.keys(gains).length > 0 ? gains : null;
}

