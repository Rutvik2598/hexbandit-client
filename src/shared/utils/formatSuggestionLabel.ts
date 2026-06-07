import type { ActionPwin } from '@/shared/types/game';

const RESOURCE_IDX_EMOJI = ['🪵', '🧱', '🐑', '🌾', '⛏️'];
const RESOURCE_IDX_LABEL = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'];

function parseIntArray(str: string): number[] {
  return (str.match(/-?\d+/g) ?? []).map(Number);
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
