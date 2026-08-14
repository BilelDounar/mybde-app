import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

import { AppColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

/**
 * Barrière d'authentification des écrans privés.
 *
 * Chaque route est un point d'entrée à part entière : sur le web, l'utilisateur
 * recharge la page ou ouvre un lien partagé sans jamais passer par « / », donc
 * la redirection posée sur l'écran racine ne protège rien. Sans barrière, une
 * session absente ou expirée laisse l'écran s'afficher à vide — plus de nom ni
 * de rôle, alors que les actions restent visibles.
 *
 * Le contenu est monté en un seul bloc plutôt que court-circuité à l'intérieur
 * de l'écran : un `return` anticipé au milieu des hooks changerait leur nombre
 * d'un rendu à l'autre une fois la session restaurée.
 *
 * Les écrans publics (connexion, inscription, pages légales, 404) ne l'utilisent
 * pas : ils doivent rester consultables déconnecté.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Restauration de session en cours : ni contenu, ni redirection prématurée.
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.background,
  },
});
