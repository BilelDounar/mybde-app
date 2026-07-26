import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const VARIANT_STYLES = {
  primary: { bg: AppColors.primaryLight, text: AppColors.primary },
  success: { bg: AppColors.successLight, text: AppColors.success },
  warning: { bg: AppColors.warningLight, text: AppColors.warning },
  danger: { bg: AppColors.dangerLight, text: AppColors.danger },
  neutral: { bg: AppColors.surface, text: AppColors.textSecondary },
  info: { bg: '#DBEAFE', text: '#2563EB' },
};

export function Badge({ label, variant = 'primary', size = 'sm', style }: BadgeProps) {
  const colors = VARIANT_STYLES[variant];

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colors.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
  },
  sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: FontSizes.xs,
  },
  textMd: {
    fontSize: FontSizes.sm,
  },
});
