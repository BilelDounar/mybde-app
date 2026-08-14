import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

import { useTransition } from '@/context/TransitionContext';

/**
 * Recharge les données d'un écran quand une modification a eu lieu ailleurs
 * dans l'application (publication d'un événement, d'une actualité, édition…).
 *
 * Les onglets d'expo-router restent montés en arrière-plan : un `useEffect` de
 * montage ne se rejoue jamais, et l'écran affiche donc éternellement les
 * chiffres chargés à l'ouverture. On s'appuie sur le compteur `dataVersion` de
 * TransitionContext, incrémenté par `markDirty()` à chaque écriture réussie.
 *
 * Le rechargement est différé au retour sur l'écran (`useFocusEffect`) pour ne
 * pas déclencher un appel réseau par onglet à chaque écriture. Un écran déjà
 * au premier plan, lui, se rafraîchit immédiatement.
 */
export function useRefreshWhenStale(reload: () => void | Promise<void>) {
  const { dataVersion } = useTransition();
  // Version déjà reflétée par les données affichées : au montage, l'écran vient
  // de charger, il est donc à jour quelle que soit la valeur du compteur.
  const seenVersion = useRef(dataVersion);

  useFocusEffect(
    useCallback(() => {
      if (seenVersion.current === dataVersion) return;
      seenVersion.current = dataVersion;
      void reload();
    }, [dataVersion, reload]),
  );
}
