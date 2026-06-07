import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { playSound, SFX } from './useSound';

export function useSoundEffects() {
  const logEntries    = useGameStore(s => s.logEntries);
  const resourceGains = useGameStore(s => s.resourceGains);
  const lastRollDice  = useGameStore(s => s.lastRollDice);
  const replayMode    = useGameStore(s => s.replayMode);
  const gameState     = useGameStore(s => s.gameState);

  const initializedRef = useRef(false);
  const lastLogIdRef   = useRef(0);
  const prevDiceRef    = useRef<typeof lastRollDice>(null);
  const prevGainsRef   = useRef<typeof resourceGains>(null);

  // Capture baseline on first load so replayed historical data doesn't trigger sounds.
  useEffect(() => {
    if (gameState && !initializedRef.current) {
      initializedRef.current = true;
      prevDiceRef.current    = lastRollDice;
      prevGainsRef.current   = resourceGains;
      lastLogIdRef.current   = logEntries[logEntries.length - 1]?.id ?? 0;
    }
  }, [gameState, lastRollDice, resourceGains, logEntries]);

  // Dice roll
  useEffect(() => {
    if (!initializedRef.current || replayMode) return;
    if (lastRollDice && lastRollDice !== prevDiceRef.current) {
      playSound(SFX.diceRoll);
    }
    prevDiceRef.current = lastRollDice;
  }, [lastRollDice, replayMode]);

  useEffect(() => {
    if (!initializedRef.current || replayMode) return;
    if (!resourceGains || resourceGains === prevGainsRef.current) return;
    prevGainsRef.current = resourceGains;

    const state = useGameStore.getState();
    const humanColors = new Set<string>(
      state.humanPlayerIndices
        .map(i => state.gameState?.players[i]?.color)
        .filter(Boolean) as string[]
    );

    const hasGains = humanColors.size === 0
      ? Object.values(resourceGains).some(g => g && Object.values(g).some(v => (v as number) > 0))
      : Object.entries(resourceGains).some(([color, g]) =>
          humanColors.has(color) && g && Object.values(g).some(v => (v as number) > 0)
        );

    if (hasGains) playSound(SFX.resourceCollect, 0.65);
  }, [resourceGains, replayMode]);

  useEffect(() => {
    if (!initializedRef.current || replayMode) return;
    const newEntries = logEntries.filter(
      e => e.id > lastLogIdRef.current && e.level === 'action'
    );
    if (newEntries.length === 0) return;
    lastLogIdRef.current = logEntries[logEntries.length - 1]?.id ?? lastLogIdRef.current;

    for (const entry of newEntries) {
      const msg = entry.message;
      if (msg.includes('BUILD SETTLEMENT')) { playSound(SFX.settlement);      break; }
      if (msg.includes('BUILD CITY'))       { playSound(SFX.city);            break; }
      if (msg.includes('BUILD ROAD'))       { playSound(SFX.road);            break; }
      if (msg.includes('MOVE ROBBER'))      { playSound(SFX.robber, 0.6);     break; }
    }
  }, [logEntries, replayMode]);
}
