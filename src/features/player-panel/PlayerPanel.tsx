import { useGameStore } from '@/store/gameStore';
import PlayerCard from './PlayerCard';
import type { PlayerColor } from '@/shared/types/game';

export default function PlayerPanel() {
  const gameState          = useGameStore(s => s.gameState);
  const humanPlayerIndices = useGameStore(s => s.humanPlayerIndices);
  const lastPwin           = useGameStore(s => s.lastPwin);
  const resourceGains      = useGameStore(s => s.resourceGains);
  const thinking           = useGameStore(s => s.thinking);

  if (!gameState) return null;

  const isAiThinking = thinking.phase === 'thinking' || thinking.phase === 'submitting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="eyebrow" style={{ padding: '0 2px' }}>Players</div>
      {gameState.players.map(player => {
        const isCurrentTurn = player.index === gameState.current_player_index;
        const isHuman = humanPlayerIndices.includes(player.index);
        return (
          <PlayerCard
            key={player.color}
            player={player}
            isCurrentTurn={isCurrentTurn}
            isHumanPlayer={isHuman}
            pwin={lastPwin?.[player.color as PlayerColor] ?? null}
            resourceGains={resourceGains?.[player.color]}
            isThinking={isCurrentTurn && !isHuman && isAiThinking}
          />
        );
      })}
    </div>
  );
}
