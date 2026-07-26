import React, { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppColors, Gradients } from '@/constants/theme';

interface LogoProps {
  /** Largeur/hauteur du logo en points. */
  size?: number;
  /** Couleur du glyphe (le logo se décline dans n'importe quelle teinte). */
  color?: string;
  /** Remplit le glyphe avec le dégradé de marque au lieu d'une teinte unie. */
  gradient?: boolean;
}

/**
 * Logo MyBDE — mortier de diplômé abstrait (losange + cordon), sans fond.
 * Monochrome par défaut : se décline dans n'importe quelle couleur selon le
 * contexte, ou en dégradé de marque via `gradient`.
 */
export function Logo({ size = 40, color = AppColors.primary, gradient = false }: LogoProps) {
  const gradientId = useId();
  const fill = gradient ? `url(#${gradientId})` : color;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {gradient && (
        <Defs>
          <LinearGradient id={gradientId} x1="4" y1="6" x2="44" y2="40" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={Gradients.brand[0]} />
            <Stop offset="1" stopColor={Gradients.brand[1]} />
          </LinearGradient>
        </Defs>
      )}

      {/* Plateau du mortier (losange supérieur) */}
      <Path d="M24 6.5 L44 18.5 L24 30.5 L4 18.5 Z" fill={fill} />
      {/* Retombée abstraite (facette inférieure) */}
      <Path d="M10.5 21.5 L24 30 L37.5 21.5 L24 41.5 Z" fill={fill} opacity={0.45} />
      {/* Cordon du gland */}
      <Path
        d="M24 18.5 L39.5 25 L39.5 35"
        stroke={fill}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Gland */}
      <Circle cx="39.5" cy="36.8" r="2.4" fill={fill} />
    </Svg>
  );
}
