import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

interface ItemIconProps {
  type?: string;
  size?: number;
  itemName?: string;
  itemStats?: Record<string, any> | null;
}

const iconStroke = '#111827';

export const ItemIcon: React.FC<ItemIconProps> = ({
  type = 'unknown',
  size = 24,
  itemName,
  itemStats,
}) => {
  const isManaConsumable =
    type === 'consumable' &&
    (Number(itemStats?.mana || 0) > 0 || (itemName || '').toLowerCase().includes('mana'));

  switch (type) {
    case 'weapon':
    case 'sword':
    case 'dagger':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1="4" y1="20" x2="17" y2="7" stroke={iconStroke} strokeWidth="2" />
          <Rect x="16" y="3" width="4" height="8" fill="#9ca3af" stroke={iconStroke} />
          <Rect x="2" y="18" width="6" height="3" fill="#b45309" stroke={iconStroke} />
        </Svg>
      );
    case 'offhand':
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 3L19 6V12C19 16 16 19 12 21C8 19 5 16 5 12V6L12 3Z" fill="#60a5fa" stroke={iconStroke} strokeWidth="1.5" />
        </Svg>
      );
    case 'helmet':
    case 'head':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 13C4 8.5 7.5 5 12 5C16.5 5 20 8.5 20 13V16H4V13Z" fill="#9ca3af" stroke={iconStroke} />
          <Rect x="7" y="12" width="10" height="3" fill="#111827" />
        </Svg>
      );
    case 'armor':
    case 'chest':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M7 4L10 6H14L17 4L20 8L17 20H7L4 8L7 4Z" fill="#d1d5db" stroke={iconStroke} />
        </Svg>
      );
    case 'boots':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 14H11V18H20V21H4V14Z" fill="#92400e" stroke={iconStroke} />
        </Svg>
      );
    case 'belt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="8" width="18" height="8" rx="2" fill="#92400e" stroke={iconStroke} />
          <Rect x="10" y="9" width="4" height="6" fill="#d1d5db" stroke={iconStroke} />
        </Svg>
      );
    case 'bag':
    case 'bags':
    case 'backpack':
    case 'pouch':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="5" y="6" width="14" height="14" fill="#8b5a2b" stroke={iconStroke} />
          <Rect x="9" y="4" width="6" height="4" fill="#6b4226" stroke={iconStroke} />
          <Rect x="9" y="11" width="6" height="5" fill="#d1d5db" stroke={iconStroke} />
        </Svg>
      );
    case 'ring':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="6" fill="#facc15" stroke={iconStroke} strokeWidth="2" />
          <Circle cx="12" cy="12" r="2" fill="#fef3c7" />
        </Svg>
      );
    case 'consumable':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="9" y="3" width="6" height="4" fill="#6b7280" stroke={iconStroke} />
          <Path d="M7 7H17L16 20H8L7 7Z" fill={isManaConsumable ? '#2563eb' : '#ef4444'} stroke={iconStroke} />
        </Svg>
      );
    case 'currency':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="8" fill="#f59e0b" stroke={iconStroke} strokeWidth="2" />
          <Path d="M9 12H15" stroke="#7c2d12" strokeWidth="2" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="4" y="4" width="16" height="16" fill="#6b7280" stroke={iconStroke} />
        </Svg>
      );
  }
};
