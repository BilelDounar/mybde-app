import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { AppColors, BorderRadius, FontFamily, FontSizes, Spacing } from '@/constants/theme';

interface ErrorScreenProps {
  /** Code affiché en gros (404, 500…). Omis pour une erreur sans statut. */
  code?: string;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Action principale (ex. « Réessayer », « Retour à l'accueil »). */
  actionLabel?: string;
  onAction?: () => void;
  /** Action secondaire, affichée en bouton discret. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Détail technique, replié visuellement : utile en support, ignoré du grand public. */
  detail?: string;
}

/**
 * Écran d'erreur pleine page, partagé par le 404 et la barrière d'erreur.
 * Volontairement sans appel réseau ni contexte : il doit pouvoir s'afficher
 * même quand l'application est dans un état dégradé.
 */
export function ErrorScreen({
  code,
  title,
  message,
  icon = 'alert-circle-outline',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  detail,
}: ErrorScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={40} color={AppColors.primary} />
        </View>

        {!!code && <Text style={styles.code}>{code}</Text>}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {!!detail && (
          <View style={styles.detailBox}>
            <Text style={styles.detailText} numberOfLines={4}>
              {detail}
            </Text>
          </View>
        )}

        {!!actionLabel && !!onAction && (
          <Button title={actionLabel} onPress={onAction} size="lg" fullWidth style={styles.action} />
        )}
        {!!secondaryLabel && !!onSecondary && (
          <Button title={secondaryLabel} onPress={onSecondary} variant="ghost" size="md" fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryLight,
    marginBottom: Spacing.lg,
  },
  code: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    color: AppColors.primary,
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.displaySemibold,
    fontSize: FontSizes.xl,
    color: AppColors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  detailBox: {
    width: '100%',
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
  },
  action: {
    marginBottom: Spacing.sm,
  },
});
