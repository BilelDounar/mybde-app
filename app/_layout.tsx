import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/AuthContext';
import { DialogProvider } from '@/context/DialogContext';
import { TransitionProvider } from '@/context/TransitionContext';
import { AppColors } from '@/constants/theme';
import { ErrorScreen } from '@/components/ErrorScreen';
import { installGlobalFont } from '@/lib/global-font';

installGlobalFont();
SplashScreen.preventAutoHideAsync();

/**
 * Barrière d'erreur racine, reconnue par expo-router. Sans elle, une exception
 * levée pendant le rendu laisse un écran blanc en production (React démonte
 * tout l'arbre sans rien afficher).
 *
 * `retry()` retente le rendu de la branche fautive : suffisant pour une erreur
 * transitoire, sinon l'utilisateur repart de l'accueil.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorScreen
      code="500"
      icon="warning-outline"
      title="Une erreur est survenue"
      message="L'application n'a pas réussi à afficher cette page. Vous pouvez réessayer ou revenir à l'accueil."
      detail={error?.message}
      actionLabel="Réessayer"
      onAction={retry}
      secondaryLabel="Retour à l'accueil"
      onSecondary={() => {
        router.replace('/');
        retry();
      }}
    />
  );
}

const MyBDETheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: AppColors.primary,
    background: AppColors.background,
    card: AppColors.white,
    text: AppColors.text,
    border: AppColors.border,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <DialogProvider>
        <TransitionProvider>
          <ThemeProvider value={MyBDETheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              {/* Guide de démarrage affiché juste après l'inscription. */}
              <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen
                name="event/[id]"
                options={{ headerShown: false, animation: 'slide_from_right' }}
              />
              {/* Sur le web, la présentation « modal » de react-native-screens
                  peut se démonter aussitôt (l'écran apparaît puis disparaît) :
                  on retombe sur une présentation « card » (page pleine) fiable. */}
              <Stack.Screen
                name="ticketing/[id]"
                options={{ presentation: Platform.OS === 'web' ? 'card' : 'modal', headerShown: false }}
              />
              <Stack.Screen
                name="recharge"
                options={{ presentation: Platform.OS === 'web' ? 'card' : 'modal', headerShown: false }}
              />
            </Stack>
            <StatusBar style="dark" />
          </ThemeProvider>
        </TransitionProvider>
      </DialogProvider>
    </AuthProvider>
  );
}
