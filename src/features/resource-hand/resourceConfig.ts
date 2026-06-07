import type { ResourceType } from '@/shared/types/game';

export interface ResourceConfig {
  key: ResourceType;
  name: string;
  color: string;
}

export const RESOURCE_CONFIG: ResourceConfig[] = [
  { key: 'wood',  name: 'Wood',  color: 'var(--r-wood)'  },
  { key: 'brick', name: 'Brick', color: 'var(--r-brick)' },
  { key: 'sheep', name: 'Sheep', color: 'var(--r-sheep)' },
  { key: 'wheat', name: 'Wheat', color: 'var(--r-wheat)' },
  { key: 'ore',   name: 'Ore',   color: 'var(--r-ore)'   },
];
