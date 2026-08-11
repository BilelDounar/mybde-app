import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppColors, FontFamily, FontSizes, Spacing } from '@/constants/theme';

interface Section {
  heading: string;
  body: string;
}

interface Doc {
  title: string;
  intro: string;
  sections: Section[];
}

// Contenus statiques embarqués : évite de dépendre d'un site externe (les liens
// « mybde.fr/help » et « mybde.fr/terms » n'existent pas) tout en offrant un vrai
// centre d'aide et des conditions générales consultables hors ligne.
const DOCS: Record<string, Doc> = {
  help: {
    title: "Centre d'aide",
    intro: 'Les réponses aux questions les plus fréquentes sur MyBDE.',
    sections: [
      {
        heading: 'Comment rejoindre un BDE ?',
        body: "Depuis l'accueil ou votre profil, saisissez le code d'invitation à 6 chiffres communiqué par votre BDE. Une fois membre, vous voyez ses actualités, ses événements et sa billetterie.",
      },
      {
        heading: 'Comment obtenir un billet ?',
        body: "Ouvrez un événement puis choisissez un tarif. Le paiement peut se faire par carte (simulé) ou avec vos crédits BDE. Votre billet et son QR code apparaissent dans l'onglet Billets.",
      },
      {
        heading: 'À quoi servent les crédits BDE ?',
        body: 'Les crédits BDE sont un porte-monnaie interne rechargeable depuis votre profil. Ils permettent de régler vos billets sans carte à chaque achat.',
      },
      {
        heading: 'Que se passe-t-il si je quitte un BDE ?',
        body: "Vos billets valides pour des événements à venir de ce BDE sont annulés et remboursés sur votre solde. L'historique de vos billets passés reste conservé.",
      },
      {
        heading: 'Comment supprimer mon compte ?',
        body: 'Profil → Données personnelles → Supprimer mon compte. La suppression est définitive et efface toutes vos données (RGPD).',
      },
    ],
  },
  terms: {
    title: 'Conditions générales',
    intro: "En utilisant MyBDE, vous acceptez les conditions ci-dessous.",
    sections: [
      {
        heading: '1. Objet',
        body: "MyBDE met en relation les étudiants et leurs Bureaux Des Étudiants pour la diffusion d'actualités, la gestion d'événements et la billetterie associée.",
      },
      {
        heading: '2. Compte utilisateur',
        body: "Vous êtes responsable de l'exactitude des informations de votre compte et de la confidentialité de vos identifiants. Un compte est strictement personnel.",
      },
      {
        heading: '3. Billetterie et paiements',
        body: "Les paiements sont actuellement simulés dans le cadre de ce projet. Les frais de réservation éventuels sont affichés avant validation de la commande.",
      },
      {
        heading: '4. Données personnelles (RGPD)',
        body: "Vous pouvez à tout moment exporter ou supprimer vos données depuis votre profil. Vos données ne sont pas revendues à des tiers.",
      },
      {
        heading: '5. Contact',
        body: "Pour toute question, écrivez à support@mybde.fr.",
      },
    ],
  },
};

export default function InfoScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const doc = DOCS[topic ?? ''] ?? DOCS.help;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: doc.title }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={AppColors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{doc.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{doc.intro}</Text>
        {doc.sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: AppColors.background,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontFamily: FontFamily.display, fontSize: FontSizes.xl, color: AppColors.text },
  content: { padding: Spacing.base, maxWidth: 720, width: '100%', alignSelf: 'center' },
  intro: { fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  section: { marginBottom: Spacing.lg },
  heading: { fontFamily: FontFamily.displaySemibold, fontSize: FontSizes.md, color: AppColors.text, marginBottom: Spacing.xs },
  body: { fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.textSecondary, lineHeight: 22 },
});
