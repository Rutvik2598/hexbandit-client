/** SVG line-art UI icons — used for non-resource game UI elements. */

export type IconName =
  | 'settlement' | 'city' | 'road' | 'devcard'
  | 'dice' | 'arrow-right' | 'swap' | 'check' | 'close'
  | 'bank' | 'star' | 'cards' | 'play' | 'robot' | 'user'
  | 'chevron' | 'road-badge' | 'army-badge';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.7, className }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style: { flexShrink: 0, display: 'block' },
  };

  switch (name) {
    case 'settlement':
      return <svg {...p}><path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/></svg>;
    case 'city':
      return <svg {...p}><path d="M3 20V11l5-4v3l5-4v3l5-3v14"/><path d="M3 20h17"/></svg>;
    case 'road':
      return <svg {...p}><path d="M5 19L13 5"/><path d="M11 19L19 5"/></svg>;
    case 'devcard':
      return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>;
    case 'dice':
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.2" fill={color} stroke="none"/><circle cx="16" cy="16" r="1.2" fill={color} stroke="none"/><circle cx="12" cy="12" r="1.2" fill={color} stroke="none"/></svg>;
    case 'arrow-right':
      return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'swap':
      return <svg {...p}><path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/></svg>;
    case 'check':
      return <svg {...p}><path d="M5 13l4 4L19 7"/></svg>;
    case 'close':
      return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'bank':
      return <svg {...p}><path d="M3 9l9-5 9 5"/><path d="M5 9v9M19 9v9M9 9v9M15 9v9"/><path d="M3 20h18"/></svg>;
    case 'star':
      return <svg {...p}><path d="M12 3l2.6 5.6L20.5 9.5l-4.3 4.1 1 6L12 16.9 6.8 19.6l1-6L3.5 9.5l5.9-.9z"/></svg>;
    case 'cards':
      return <svg {...p}><rect x="3" y="6" width="13" height="14" rx="2"/><path d="M8 6V4a2 2 0 012-2h9a2 2 0 012 2v12a2 2 0 01-2 2h-2"/></svg>;
    case 'play':
      return <svg {...p}><path d="M7 4l13 8-13 8z" fill={color} stroke="none"/></svg>;
    case 'robot':
      return <svg {...p}><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="13.5" r="1.2" fill={color} stroke="none"/><circle cx="15" cy="13.5" r="1.2" fill={color} stroke="none"/></svg>;
    case 'user':
      return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>;
    case 'chevron':
      return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'road-badge':
      return <svg {...p}><path d="M4 18c4 0 4-12 8-12s4 12 8 12"/></svg>;
    case 'army-badge':
      return <svg {...p}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>;
    default:
      return null;
  }
}
