import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { PageTitle } from '@/components/PageTitle';
import { AppColors, FontFamily, FontSizes, Spacing, BorderRadius } from '@/constants/theme';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch {
      setError('Identifiants invalides. Veuillez réessayer.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <PageTitle title="Connexion" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo size={80} gradient />
            <Text style={styles.appName}>MyBDE</Text>
          </View>

          {/* Header */}
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={AppColors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <Input
            label="E-mail"
            placeholder="bilel@mybde.fr"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail-outline"
          />

          <Input
            label="Mot de passe"
            placeholder="Entrez votre mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock-closed-outline"
          />

          <Pressable style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
          </Pressable>

          {/* Login Button */}
          <Button
            title="Se connecter"
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            size="lg"
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OAuth Buttons — bientôt disponibles */}
          <View style={styles.oauthRow}>
            <View style={[styles.oauthButton, styles.oauthDisabled]}>
              <Ionicons name="logo-google" size={22} color={AppColors.textLight} />
              <Text style={[styles.oauthText, styles.oauthTextDisabled]}>Google</Text>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Bientôt</Text>
              </View>
            </View>
            <View style={[styles.oauthButton, styles.oauthDisabled]}>
              <Ionicons name="logo-apple" size={22} color={AppColors.textLight} />
              <Text style={[styles.oauthText, styles.oauthTextDisabled]}>Apple</Text>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Bientôt</Text>
              </View>
            </View>
          </View>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore de compte ? </Text>
            <Pressable onPress={() => router.push('/signup')}>
              <Text style={styles.footerLink}>S&apos;inscrire</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  appName: {
    marginTop: Spacing.md,
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xxl,
    color: AppColors.primary,
    letterSpacing: 1,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xxxl,
    color: AppColors.text,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.dangerLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.base,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: AppColors.danger,
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xl,
    marginTop: -Spacing.sm,
  },
  forgotPasswordText: {
    fontSize: FontSizes.sm,
    color: AppColors.primary,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AppColors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
  },
  oauthRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    backgroundColor: AppColors.white,
  },
  oauthText: {
    fontSize: FontSizes.base,
    fontWeight: '500',
    color: AppColors.text,
  },
  oauthDisabled: {
    backgroundColor: AppColors.surface,
    borderColor: AppColors.borderLight,
  },
  oauthTextDisabled: {
    color: AppColors.textLight,
  },
  soonBadge: {
    backgroundColor: AppColors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  soonBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: AppColors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
  },
  footerLink: {
    fontSize: FontSizes.base,
    color: AppColors.primary,
    fontWeight: '600',
  },
});
