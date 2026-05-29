import { useGameStore } from '@/store/gameStore';
import PlayerCard from './PlayerCard';
import type { PlayerColor } from '@/shared/types/game';

interface PlayerPanelProps {
  compact?: boolean;
}

export default function PlayerPanel({ compact = false }: PlayerPanelProps) {
  const gameState = useGameStore(s => s.gameState);
  const humanPlayerIndices = useGameStore(s => s.humanPlayerIndices);
  const lastPwin = useGameStore(s => s.lastPwin);
  const resourceGains = useGameStore(s => s.resourceGains);

  if (!gameState) return null;

  const currentPlayerIndex = gameState.current_player_index;

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {gameState.players.map(player => (
        <PlayerCard
          key={player.color}
          player={player}
          isCurrentTurn={player.index === currentPlayerIndex}
          isHumanPlayer={humanPlayerIndices.includes(player.index)}
          pwin={lastPwin?.[player.color as PlayerColor] ?? null}
          compact={compact}
          resourceGains={resourceGains?.[player.color]}
        />
      ))}
    </div>
  );
}
