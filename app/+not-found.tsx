import React from 'react';
import { Stack, router, usePathname } from 'expo-router';

import { ErrorScreen } from '@/components/ErrorScreen';
import { PageTitle } from '@/components/PageTitle';

/**
 * Route de repli d'expo-router : toute URL inconnue arrive ici.
 * Sur le web, nginx sert index.html pour les chemins non résolus, c'est donc
 * bien cet écran que voit l'utilisateur (et non une page d'erreur du serveur).
 */
export default function NotFoundScreen() {
  const pathname = usePathname();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PageTitle title="Page introuvable" />
      <ErrorScreen
        code="404"
        icon="compass-outline"
        title="Cette page n'existe pas"
        message="Le lien que vous avez suivi est peut-être erroné, ou la page a été déplacée."
        detail={pathname ? `Chemin demandé : ${pathname}` : undefined}
        actionLabel="Retour à l'accueil"
        onAction={() => router.replace('/')}
        secondaryLabel="Page précédente"
        onSecondary={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </>
  );
}
