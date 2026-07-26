import { Platform } from 'react-native';

// ─── MyBDE Design System ───────────────────────────────────

export const AppColors = {
  primary: '#4A80F0',
  primaryLight: '#E8EEFF',
  primaryDark: '#3060D0',
  secondary: '#6D5DF6',
  secondaryDark: '#2D2E8C',
  accent: '#7C3AED',
  accentLight: '#EDE9FE',
  cyan: '#22D3EE',
  pink: '#F471B5',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  surfaceAlt: '#F0F2FF',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

// Dégradés réutilisables (identité « Aurora » indigo → violet).
export const Gradients = {
  brand: ['#4A80F0', '#6D5DF6'] as const,
  brandDark: ['#3A6AE0', '#5B3FD6'] as const,
  hero: ['#6D5DF6', '#4A80F0', '#22D3EE'] as const,
  violet: ['#7C3AED', '#4A80F0'] as const,
  sunset: ['#7C3AED', '#F471B5'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const FontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 36,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

// Familles de polices chargées via @expo-google-fonts (cf. app/_layout).
// Space Grotesk : titres d'impact. Inter : texte courant / UI.
export const FontFamily = {
  display: 'SpaceGrotesk_700Bold',
  displaySemibold: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyBlack: 'Inter_800ExtraBold',
};

// Mappe un fontWeight vers la bonne famille Inter (texte courant).
export function interForWeight(weight?: string | number): string {
  const w = String(weight ?? '400');
  if (w === '500') return FontFamily.bodyMedium;
  if (w === '600') return FontFamily.bodySemibold;
  if (w === '700' || w === 'bold') return FontFamily.bodyBold;
  if (w === '800' || w === '900') return FontFamily.bodyBlack;
  return FontFamily.body;
}

// Legacy compatibility
export const Colors = {
  light: {
    text: AppColors.text,
    background: AppColors.background,
    tint: AppColors.primary,
    icon: AppColors.textSecondary,
    tabIconDefault: AppColors.textLight,
    tabIconSelected: AppColors.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});
