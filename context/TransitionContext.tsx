import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/theme';

interface TransitionContextType {
  /** Marque qu'une information vient d'être modifiée (édition, sauvegarde…). */
  markDirty: () => void;
  /** Si une modification est en attente, affiche le rideau puis efface le flag. Sinon ne fait rien. */
  flashIfDirty: () => void;
  /**
   * Compteur incrémenté à chaque `markDirty()`. Les écrans s'en servent comme
   * signal d'invalidation : les onglets restent montés en arrière-plan, donc
   * sans ce signal ils garderaient indéfiniment les données chargées au montage
   * (compteurs figés après une création). Voir `useRefreshWhenStale`.
   */
  dataVersion: number;
}

const TransitionContext = createContext<TransitionContextType | null>(null);

const CURTAIN_MS = 220;

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const dirtyRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDataVersion((v) => v + 1);
  }, []);

  const flashIfDirty = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setVisible(true);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: CURTAIN_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: CURTAIN_MS, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [opacity]);

  const value = useMemo(
    () => ({ markDirty, flashIfDirty, dataVersion }),
    [markDirty, flashIfDirty, dataVersion],
  );

  return (
    <TransitionContext.Provider value={value}>
      {children}
      {visible && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.curtain, { opacity, pointerEvents: 'none' }]} />
      )}
    </TransitionContext.Provider>
  );
}

export function useTransition(): TransitionContextType {
  const ctx = useContext(TransitionContext);
  if (!ctx) {
    throw new Error('useTransition must be used within a TransitionProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  curtain: {
    backgroundColor: AppColors.background,
    zIndex: 999,
  },
});
