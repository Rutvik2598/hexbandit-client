import { cubeToKey } from '@/entities/board/coordinates';
import type { ActionPwin } from '@/shared/types/game';

export type SuggestionHighlight =
  | { type: 'settlement'; nodeId: number }
  | { type: 'city';       nodeId: number }
  | { type: 'road';       edge: [number, number] }
  | { type: 'robber';     tileKey: string }
  | null;

/**
 * Extracts a board location from an ActionPwin so the corresponding node,
 * edge, or tile can be previewed on the 3D board when the user hovers or
 * taps a suggestion row.
 *
 * Priority: structured `value` field (when the API returns it) → label parse.
 * Returns null for actions with no fixed location (buy dev card, roll, …).
 */
export function parseSuggestionHighlight(ap: ActionPwin): SuggestionHighlight {
  const raw   = ap.action_label.trim();
  const label = raw.toLowerCase();

  // ── Structured value ────────────────────────────────────────────────────────
  if (ap.value !== undefined && ap.value !== null) {
    if (typeof ap.value === 'number') {
      if (label.includes('settlement')) return { type: 'settlement', nodeId: ap.value };
      if (label.includes('city'))       return { type: 'city',       nodeId: ap.value };
    }
    if (
      Array.isArray(ap.value) &&
      ap.value.length === 2 &&
      typeof ap.value[0] === 'number' &&
      typeof ap.value[1] === 'number' &&
      label.includes('road')
    ) {
      return { type: 'road', edge: [ap.value[0], ap.value[1]] };
    }
    // Robber value: [[q,r,s], victimColor] or [q,r,s]
    if (Array.isArray(ap.value) && label.includes('robber')) {
      const first = ap.value[0];
      if (Array.isArray(first) && first.length === 3 &&
          first.every((v) => typeof v === 'number')) {
        return { type: 'robber', tileKey: cubeToKey(first[0], first[1], first[2]) };
      }
      // Flat [q, r, s] form
      if (ap.value.length === 3 && ap.value.every((v) => typeof v === 'number')) {
        const [q, r, s] = ap.value as [number, number, number];
        return { type: 'robber', tileKey: cubeToKey(q, r, s) };
      }
    }
  }

  // ── Label parsing ───────────────────────────────────────────────────────────
  // Extract all signed integers from the label string
  const nums = (raw.match(/-?\d+/g) ?? []).map(Number);
  if (!nums.length) return null;

  if (label.includes('settlement')) return { type: 'settlement', nodeId: nums[nums.length - 1] };
  if (label.includes('city'))       return { type: 'city',       nodeId: nums[nums.length - 1] };

  if (label.includes('road') && nums.length >= 2) {
    return { type: 'road', edge: [nums[nums.length - 2], nums[nums.length - 1]] };
  }

  // Robber: extract first group of 3 consecutive signed integers
  // Typical label: "MOVE_ROBBER ((1, -1, 0), None)" or "MOVE_ROBBER (1, -1, 0)"
  if (label.includes('robber') && nums.length >= 3) {
    return { type: 'robber', tileKey: cubeToKey(nums[0], nums[1], nums[2]) };
  }

  return null;
}
