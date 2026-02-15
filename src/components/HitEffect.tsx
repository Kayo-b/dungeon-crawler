import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

interface HitEffectProps {
  variant?: 'pow' | 'slash' | 'fire' | 'crush' | 'mutilate';
  size?: number;
}

export const HitEffect: React.FC<HitEffectProps> = ({ variant = 'pow', size = 60 }) => {
  if (variant === 'fire') {
    return (
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Path d="M48 8C60 20 64 30 56 44C68 40 78 48 78 62C78 78 65 90 48 90C31 90 18 78 18 62C18 50 25 40 34 34C34 44 38 50 45 54C43 40 39 26 48 8Z" fill="#f97316" stroke="#7c2d12" strokeWidth="3" />
      </Svg>
    );
  }

  if (variant === 'crush') {
    return (
      <Svg width={size} height={size} viewBox="0 0 90 90">
        <Path d="M45 12L57 30L78 33L64 48L67 69L45 60L23 69L26 48L12 33L33 30L45 12Z" fill="#94a3b8" stroke="#111827" strokeWidth="3" />
        <SvgText x="25" y="50" fontSize="18" fontWeight="700" fill="#111827">BAM</SvgText>
      </Svg>
    );
  }

  if (variant === 'mutilate') {
    return (
      <Svg width={size} height={size} viewBox="0 0 90 90">
        <Path d="M12 74L74 12" stroke="#dc2626" strokeWidth="7" strokeLinecap="round" />
        <Path d="M22 82L82 22" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" />
        <Path d="M8 52L52 8" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
      </Svg>
    );
  }

  if (variant === 'slash') {
    return (
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Path d="M8 70L65 8" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
        <Path d="M18 72L72 20" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 120 80">
      <Path d="M8 40L30 26L34 8L52 22L76 10L84 26L110 24L98 44L112 62L82 62L72 76L58 62L30 72L34 52L8 40Z" fill="#f59e0b" stroke="#7c2d12" strokeWidth="3" />
      <SvgText x="35" y="48" fontSize="24" fontWeight="700" fill="#111827">POW</SvgText>
    </Svg>
  );
};
