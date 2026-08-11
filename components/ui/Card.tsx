import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppColors, BorderRadius, Spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: number;
}

export function Card({
  children,
  style,
  variant = 'elevated',
  padding = Spacing.base,
}: CardProps) {
  return (
    <View style={[styles.base, styles[variant], { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: AppColors.card,
    boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
  },
  outlined: {
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  filled: {
    backgroundColor: AppColors.surface,
  },
});
