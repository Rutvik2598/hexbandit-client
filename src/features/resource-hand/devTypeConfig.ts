import type { DevCardType } from '@/shared/types/game';
import type { IconKey } from '@/shared/components/ResourceIcon';

export interface DevTypeConfig {
  name: string;
  icon: IconKey;
  playable: boolean;
  blurb: string;
}

export const DEV_TYPE_CONFIG: Record<DevCardType, DevTypeConfig> = {
  knight:         { name: 'Knight',         icon: 'knight',         playable: true,  blurb: 'Move the robber & steal' },
  road_building:  { name: 'Road Building',  icon: 'road_building',  playable: true,  blurb: 'Place 2 free roads' },
  year_of_plenty: { name: 'Year of Plenty', icon: 'year_of_plenty', playable: true,  blurb: 'Take any 2 resources' },
  monopoly:       { name: 'Monopoly',       icon: 'monopoly',       playable: true,  blurb: 'Claim all of one resource' },
  victory_point:  { name: 'Victory Point',  icon: 'victory_point',  playable: false, blurb: 'Hidden +1 victory point' },
};
