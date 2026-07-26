import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { AppColors, BorderRadius, FontFamily, FontSizes, Gradients, Spacing } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isGradient = variant === 'primary';

  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    isDisabled && styles.textDisabled,
  ].filter(Boolean) as TextStyle[];

  const content = loading ? (
    <ActivityIndicator
      size="small"
      color={variant === 'outline' || variant === 'ghost' ? AppColors.primary : AppColors.white}
    />
  ) : (
    <>
      {icon}
      {title ? <Text style={textStyle}>{title}</Text> : null}
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        ...containerStyle,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {isGradient && (
        <LinearGradient
          colors={Gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  variant_primary: {
    backgroundColor: AppColors.primary,
  },
  variant_secondary: {
    backgroundColor: AppColors.primaryLight,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  variant_danger: {
    backgroundColor: AppColors.danger,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },

  // Sizes
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
  },
  size_md: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    minHeight: 52,
  },

  // Text
  text: {
    fontFamily: FontFamily.displaySemibold,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  text_primary: {
    color: AppColors.white,
  },
  text_secondary: {
    color: AppColors.primary,
  },
  text_outline: {
    color: AppColors.text,
  },
  text_danger: {
    color: AppColors.white,
  },
  text_ghost: {
    color: AppColors.primary,
  },
  textSize_sm: {
    fontSize: FontSizes.sm,
  },
  textSize_md: {
    fontSize: FontSizes.base,
  },
  textSize_lg: {
    fontSize: FontSizes.md,
  },
  textDisabled: {
    opacity: 0.7,
  },
});
