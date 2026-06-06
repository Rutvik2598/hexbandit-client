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

export function playSound(path: string, volume = 0.7): void {
  if (useUiStore.getState().muted) return;
  const audio = getAudio(path);
  audio.currentTime = 0;
  audio.volume = volume;
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
