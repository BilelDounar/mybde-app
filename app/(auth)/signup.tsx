import React, { useState, useMemo } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageTitle } from '@/components/PageTitle';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';

export default function SignupScreen() {
  const { signup, refreshUser, isLoading } = useAuth();
  // Code d'invitation optionnel transmis via le lien « Inviter par lien ».
  const { code } = useLocalSearchParams<{ code?: string }>();
  const inviteCode = typeof code === 'string' ? code.trim() : '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');

  // Password strength checks
  const passwordChecks = useMemo(() => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }), [password]);

  const isFormValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasNumber &&
    password === confirmPassword &&
    acceptTerms;

  const handleSignup = async () => {
    setError('');
    if (!isFormValid) {
      setError('Veuillez remplir correctement tous les champs');
      return;
    }
    try {
      await signup(name, email, password);
      // Lien d'invitation : on rattache directement le nouvel utilisateur au BDE.
      if (inviteCode) {
        try {
          await api.joinBdeByCode(inviteCode);
          await refreshUser();
        } catch (e) {
          console.error('Adhésion via code d\'invitation échouée:', e);
        }
      }
      // Nouveau compte : on présente le guide de démarrage avant d'entrer dans
      // l'app (la connexion, elle, va directement à l'accueil).
      router.replace('/onboarding');
    } catch {
      setError('Inscription échouée. Veuillez réessayer.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <PageTitle title="Inscription" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={AppColors.text} />
          </Pressable>

          {/* Header */}
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez la communauté MyBDE</Text>

          {inviteCode ? (
            <View style={styles.inviteBox}>
              <Ionicons name="ticket-outline" size={18} color={AppColors.primary} />
              <Text style={styles.inviteText}>
                Invitation détectée : vous rejoindrez automatiquement le BDE après inscription.
              </Text>
            </View>
          ) : null}

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={AppColors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <Input
            label="Nom complet"
            placeholder="Nom Prénom"
            value={name}
            onChangeText={setName}
            icon="person-outline"
          />

          <Input
            label="E-mail"
            placeholder="vous@universite.fr"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail-outline"
          />

          <Input
            label="Mot de passe"
            placeholder="Créez un mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock-closed-outline"
          />

          {/* Password strength checklist */}
          {password.length > 0 && (
            <View style={styles.checkList}>
              <PasswordCheck label="Au moins 8 caractères" passed={passwordChecks.minLength} />
              <PasswordCheck label="Une lettre majuscule" passed={passwordChecks.hasUppercase} />
              <PasswordCheck label="Un chiffre" passed={passwordChecks.hasNumber} />
            </View>
          )}

          <Input
            label="Confirmer le mot de passe"
            placeholder="Confirmez votre mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            icon="lock-closed-outline"
            error={
              confirmPassword.length > 0 && password !== confirmPassword
                ? 'Les mots de passe ne correspondent pas'
                : undefined
            }
          />

          {/* Terms */}
          <Pressable
            style={styles.termsRow}
            onPress={() => setAcceptTerms(!acceptTerms)}
          >
            <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
              {acceptTerms && <Ionicons name="checkmark" size={14} color={AppColors.white} />}
            </View>
            <Text style={styles.termsText}>
              J&apos;accepte les <Text style={styles.termsLink}>Conditions d&apos;utilisation</Text> et la{' '}
              <Text style={styles.termsLink}>Politique de confidentialité</Text>
            </Text>
          </Pressable>

          {/* Register Button */}
          <Button
            title="Créer un compte"
            onPress={handleSignup}
            loading={isLoading}
            disabled={!isFormValid}
            fullWidth
            size="lg"
          />

          {/* Sign In Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ? </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.footerLink}>Se connecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Password Check Row ────────────────────────────────────

function PasswordCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons
        name={passed ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={passed ? AppColors.success : AppColors.textLight}
      />
      <Text style={[styles.checkLabel, passed && styles.checkLabelPassed]}>{label}</Text>
    </View>
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
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: AppColors.text,
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
  inviteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.primaryLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.base,
  },
  inviteText: {
    fontSize: FontSizes.sm,
    color: AppColors.primary,
    flex: 1,
  },
  checkList: {
    marginTop: -Spacing.sm,
    marginBottom: Spacing.base,
    gap: Spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkLabel: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
  },
  checkLabelPassed: {
    color: AppColors.success,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: AppColors.primary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
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
