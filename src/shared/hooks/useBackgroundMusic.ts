import { useEffect, useRef } from 'react';
import { useUiStore } from '@/store/uiStore';

export function useBackgroundMusic(volume = 0.22) {
  const muted    = useUiStore(s => s.muted);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/assets/sounds/background.wav');
    audio.loop   = true;
    audio.volume = volume;
    audioRef.current = audio;

    const tryPlay = () => {
      if (!useUiStore.getState().muted) audio.play().catch(() => {});
    };
    tryPlay();
    document.addEventListener('click',   tryPlay, { once: true });
    document.addEventListener('keydown', tryPlay, { once: true });

    return () => {
      document.removeEventListener('click',   tryPlay);
      document.removeEventListener('keydown', tryPlay);
      audio.pause();
      audio.src = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Respond to mute toggle without recreating the audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [muted]);
}
