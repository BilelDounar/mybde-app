import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AuthGate } from '@/components/AuthGate';
import { Button } from '@/components/ui/Button';
import { PageTitle } from '@/components/PageTitle';
import { AppColors, FontFamily, FontSizes, Spacing, BorderRadius } from '@/constants/theme';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}

// Guide de démarrage volontairement court : quelques écrans pour situer l'app,
// puis une invitation à compléter son profil. Rien de bloquant (« Passer »).
const SLIDES: Slide[] = [
  {
    icon: 'sparkles-outline',
    title: 'Bienvenue sur MyBDE 👋',
    text: "MyBDE, c'est ton bureau des étudiants dans la poche : les actus, les événements et la billetterie de ta vie étudiante, réunis au même endroit.",
  },
  {
    icon: 'people-outline',
    title: 'Rejoins ton BDE',
    text: "Avec le code à 6 chiffres partagé par ton BDE, rejoins-le pour débloquer ses actualités, ses événements et ses billets. Tu peux appartenir à plusieurs BDE.",
  },
  {
    icon: 'ticket-outline',
    title: 'Événements & billets',
    text: "Parcours les événements, réserve ta place en quelques secondes et garde ton billet avec QR code sur toi. À l'entrée, tu n'as plus qu'à le présenter.",
  },
  {
    icon: 'person-circle-outline',
    title: 'Complète ton profil',
    text: "Dernière étape : renseigne ton profil (nom, filière, contact) depuis l'onglet Profil. Ça ne prend qu'une minute et personnalise ton expérience.",
  },
];

export default function OnboardingRoute() {
  return (
    <AuthGate>
      <OnboardingScreen />
    </AuthGate>
  );
}

function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const goHome = () => router.replace('/(tabs)');
  const goProfile = () => router.replace('/(tabs)/profile');
  const next = () => (isLast ? goHome() : setIndex((i) => Math.min(i + 1, SLIDES.length - 1)));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  return (
    <SafeAreaView style={styles.container}>
      <PageTitle title="Bienvenue" />

      {/* En-tête : progression + « Passer » (jamais contraignant) */}
      <View style={styles.topBar}>
        <Text style={styles.step}>{index + 1}/{SLIDES.length}</Text>
        {!isLast && (
          <Pressable onPress={goHome} hitSlop={8}>
            <Text style={styles.skip}>Passer</Text>
          </Pressable>
        )}
      </View>

      {/* Contenu du slide */}
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={slide.icon} size={56} color={AppColors.primary} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.text}</Text>
      </View>

      {/* Indicateurs de page */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.footer}>
        {isLast ? (
          <>
            <Button title="Compléter mon profil" onPress={goProfile} fullWidth size="lg" />
            <Pressable onPress={goHome} style={styles.laterBtn} hitSlop={8}>
              <Text style={styles.laterText}>Plus tard, aller à l&apos;accueil</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.navRow}>
            <Button
              title="Précédent"
              variant="outline"
              onPress={prev}
              disabled={isFirst}
              style={{ flex: 1 }}
            />
            <Button title="Suivant" onPress={next} style={{ flex: 1 }} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingHorizontal: Spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  step: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
  },
  skip: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: FontSizes.sm,
    color: AppColors.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xxl,
    color: AppColors.text,
    textAlign: 'center',
  },
  text: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 420,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: AppColors.primary,
  },
  footer: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  laterText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
});
