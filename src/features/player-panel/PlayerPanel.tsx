import { useGameStore } from '@/store/gameStore';
import PlayerCard from './PlayerCard';
import type { PlayerColor } from '@/shared/types/game';

export default function PlayerPanel() {
  const gameState          = useGameStore(s => s.gameState);
  const humanPlayerIndices = useGameStore(s => s.humanPlayerIndices);
  const lastPwin           = useGameStore(s => s.lastPwin);
  const resourceGains      = useGameStore(s => s.resourceGains);

  if (!gameState) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="eyebrow" style={{ padding: '0 2px' }}>Players</div>
      {gameState.players.map(player => (
        <PlayerCard
          key={player.color}
          player={player}
          isCurrentTurn={player.index === gameState.current_player_index}
          isHumanPlayer={humanPlayerIndices.includes(player.index)}
          pwin={lastPwin?.[player.color as PlayerColor] ?? null}
          resourceGains={resourceGains?.[player.color]}
        />
      ))}
    </div>
  );
}
