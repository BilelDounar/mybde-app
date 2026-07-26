import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { useJoinBde } from '@/hooks/use-join-bde';

interface JoinBdeBannerProps {
  title?: string;
  message: string;
}

// Incitation à rejoindre un BDE, affichée tant que l'utilisateur n'en a rejoint
// aucun : un BDE conditionne l'accès aux actus/événements/billets de sa
// communauté, donc sans adhésion il n'y a rien d'autre à montrer.
export function JoinBdeBanner({ title = 'Rejoins un BDE', message }: JoinBdeBannerProps) {
  const joinBde = useJoinBde();

  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="people" size={28} color={AppColors.white} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <Pressable style={styles.btn} onPress={joinBde}>
        <Ionicons name="key-outline" size={16} color={AppColors.primary} />
        <Text style={styles.btnText}>Rejoindre avec un code</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: AppColors.primaryLight,
  },
  btnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: AppColors.primary,
  },
});
