/**
 * Image-backed game icons served from /public/assets/icons/.
 * Use ResourceIcon for resource types, ImgIcon for any named icon key,
 * and Icon for inline SVG line-art UI icons.
 */

export type IconKey =
  | 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore'
  | 'knight' | 'monopoly' | 'year_of_plenty' | 'victory_point' | 'road_building'
  | 'largest_army' | 'longest_road';

const ICON_PATHS: Record<IconKey, string> = {
  wood:           '/assets/icons/wood-icon.png',
  brick:          '/assets/icons/brick-icon.png',
  sheep:          '/assets/icons/sheep-icon.png',
  wheat:          '/assets/icons/hay-icon.png',
  ore:            '/assets/icons/ore-icon.png',
  knight:         '/assets/icons/knight-icon.png',
  monopoly:       '/assets/icons/monopoly-icon.png',
  year_of_plenty: '/assets/icons/yearofplenty-icon.png',
  victory_point:  '/assets/icons/victorypoint-icon.png',
  road_building:  '/assets/icons/tworoads-icon.png',
  largest_army:   '/assets/icons/largestarmy-icon.png',
  longest_road:   '/assets/icons/longestroad-icon.png',
};

interface ImgIconProps {
  name: IconKey;
  size?: number;
  shadow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ImgIcon({ name, size = 24, shadow = true, className, style }: ImgIconProps) {
  const src = ICON_PATHS[name];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        filter: shadow ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' : 'none',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

interface ResourceIconProps {
  type: string;
  size?: number;
  shadow?: boolean;
}

export function ResourceIcon({ type, size = 26, shadow = true }: ResourceIconProps) {
  return <ImgIcon name={type as IconKey} size={size} shadow={shadow} />;
}
