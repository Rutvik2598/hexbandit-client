import type { ActionPwin } from '@/shared/types/game';

const RESOURCE_IDX_EMOJI = ['🪵', '🧱', '🐑', '🌾', '⛏️'];
const RESOURCE_IDX_LABEL = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'];

function parseIntArray(str: string): number[] {
  return (str.match(/-?\d+/g) ?? []).map(Number);
}

function formatFreqdeck(deck: number[]): string {
  return deck
    .map((count, i) => count > 0 ? `${count > 1 ? `${count}×` : ''}${RESOURCE_IDX_EMOJI[i]}` : '')
    .filter(Boolean)
    .join(' ');
}

function formatOfferTrade(ap: ActionPwin): string {
  let give: number[] | null = null;
  let want: number[] | null = null;

  // Structured value: [[give_freqdeck], [want_freqdeck]]
  if (Array.isArray(ap.value) && ap.value.length === 2) {
    const [g, w] = ap.value as unknown[];
    if (Array.isArray(g) && Array.isArray(w) && g.length === 5 && w.length === 5) {
      give = g as number[];
      want = w as number[];
    }
  }

  // Fall back to parsing the label string
  if (!give || !want) {
    const nums = parseIntArray(ap.action_label);
    if (nums.length >= 10) {
      give = nums.slice(0, 5);
      want = nums.slice(5, 10);
    }
  }

  if (!give || !want) return 'Offer Trade';

  const giveStr = formatFreqdeck(give);
  const wantStr = formatFreqdeck(want);
  if (!giveStr && !wantStr) return 'Offer Trade';
  return `Offer Trade · Give ${giveStr || '?'} · Want ${wantStr || '?'}`;
}

function formatMaritime(nums: number[]): string {
  if (nums.length < 2) return 'Maritime Trade';
  const asking = nums[nums.length - 1];
  const givingIdxs = nums.slice(0, -1); // each entry is a resource index
  if (!givingIdxs.length) return 'Maritime Trade';

  const rate = givingIdxs.length;
  const giveIdx = givingIdxs[0];
  const giveEmoji = RESOURCE_IDX_EMOJI[giveIdx] ?? '?';
  const giveLabel = RESOURCE_IDX_LABEL[giveIdx] ?? '?';
  const getEmoji  = RESOURCE_IDX_EMOJI[asking] ?? '?';
  const getLabel  = RESOURCE_IDX_LABEL[asking] ?? '?';

  return `Trade ${rate}:1 ${giveEmoji} ${giveLabel} → ${getEmoji} ${getLabel}`;
}

const ACTION_LABELS: Record<string, string> = {
  BUILD_SETTLEMENT:    'Build Settlement',
  BUILD_CITY:          'Build City',
  BUILD_ROAD:          'Build Road',
  BUY_DEVELOPMENT_CARD:'Buy Dev Card',
  PLAY_KNIGHT_CARD:    'Play Knight',
  PLAY_YEAR_OF_PLENTY: 'Year of Plenty',
  PLAY_MONOPOLY:       'Monopoly',
  PLAY_ROAD_BUILDING:  'Road Building',
  MOVE_ROBBER:         'Move Robber',
  END_TURN:            'End Turn',
  ROLL:                'Roll Dice',
  DISCARD:             'Discard Cards',
  OFFER_TRADE:         'Offer Trade',
};

/**
 * Converts a raw action_label from the eval API (e.g. "MARITIME_TRADE (0, 0, 0, 0, 3)")
 * into a human-readable string ("Trade 4:1 🪵 Wood → 🌾 Wheat").
 *
 * Falls through to the original label if it already looks readable (contains
 * lower-case letters or is not a recognised action type).
 */
export function formatSuggestionLabel(ap: ActionPwin): string {
  const raw = ap.action_label.trim();

  // Already readable — not an ALL_CAPS prefix format
  if (/[a-z]/.test(raw.slice(0, 20)) && !raw.startsWith('MARITIME')) return raw;

  // Extract the action type token (up to first space or end of string)
  const spaceIdx = raw.indexOf(' ');
  const actionType = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1);

  // Offer trade — parse give/want freqdecks
  if (actionType === 'OFFER_TRADE') return formatOfferTrade(ap);

  // Maritime trade needs special formatting
  if (actionType === 'MARITIME_TRADE') {
    // Try structured value first
    if (Array.isArray(ap.value) && ap.value.every(v => typeof v === 'number')) {
      return formatMaritime(ap.value as number[]);
    }
    return formatMaritime(parseIntArray(rest));
  }

  // Simple label overrides
  const friendly = ACTION_LABELS[actionType];
  if (friendly) return friendly;

  // Unknown — title-case the action type
  return actionType
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
