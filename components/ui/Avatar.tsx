import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { AppColors, BorderRadius } from '@/constants/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  backgroundColor?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  '#4A80F0', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ uri, name = '?', size = 40, backgroundColor }: AvatarProps) {
  const bgColor = backgroundColor || getColorForName(name);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ─── Avatar Stack (overlapping avatars) ────────────────────

interface AvatarStackProps {
  names: string[];
  size?: number;
  max?: number;
}

export function AvatarStack({ names, size = 32, max = 4 }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const remaining = names.length - max;

  return (
    <View style={styles.stack}>
      {visible.map((name, index) => (
        <View key={index} style={[styles.stackItem, { marginLeft: index === 0 ? 0 : -(size * 0.3) }]}>
          <Avatar name={name} size={size} />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.stackItem,
            styles.remainingBadge,
            {
              marginLeft: -(size * 0.3),
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text style={[styles.remainingText, { fontSize: size * 0.32 }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: AppColors.surface,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: AppColors.white,
    fontWeight: '700',
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackItem: {
    borderWidth: 2,
    borderColor: AppColors.white,
    borderRadius: BorderRadius.full,
  },
  remainingBadge: {
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingText: {
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
});
