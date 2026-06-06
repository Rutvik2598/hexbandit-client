import { useUiStore } from '@/store/uiStore';

const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(path: string): HTMLAudioElement {
  let audio = audioCache.get(path);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = 'auto';
    audioCache.set(path, audio);
  }
  return audio;
}

/**
 * Play a sound effect.
 *
 * @param path   Path to the audio file (use SFX constants).
 * @param weight Per-sound loudness weight, 0–1 (default 1.0). Multiplied by
 *               the user's master volume setting so the relative mix is
 *               preserved while the overall level respects their preference.
 */
export function playSound(path: string, weight = 1.0): void {
  const { muted, soundVolume } = useUiStore.getState();
  if (muted) return;
  const audio = getAudio(path);
  audio.currentTime = 0;
  audio.volume = Math.min(1, (soundVolume / 100) * weight);
  audio.play().catch(() => {});
}

export const SFX = {
  settlement:      '/assets/sounds/settlement.wav',
  city:            '/assets/sounds/city.wav',
  road:            '/assets/sounds/road.wav',
  diceRoll:        '/assets/sounds/dice_roll.wav',
  resourceCollect: '/assets/sounds/resource_collect.wav',
  robber:          '/assets/sounds/robber.wav',
  yourTurn:        '/assets/sounds/your_turn.wav',
  achievement:     '/assets/sounds/achievement.wav',
} as const;
