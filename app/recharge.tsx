import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageTitle } from '@/components/PageTitle';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';

const AMOUNTS = [
  { value: 5, label: '5€', hint: 'Petit coup de pouce' },
  { value: 10, label: '10€', hint: 'Idéal pour 1 billet' },
  { value: 20, label: '20€', hint: 'Le plus populaire' },
  { value: 50, label: '50€', hint: 'Pour profiter à fond' },
];

type Step = 1 | 2 | 3;

export default function RechargeScreen() {
  const { user, refreshUser } = useAuth();
  const dialog = useDialog();

  const [selectedAmount, setSelectedAmount] = useState(20);
  const [step, setStep] = useState<Step>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      await api.rechargeCredits(selectedAmount);
      await refreshUser();
      setStep(3);
    } catch (e) {
      dialog.alert({
        title: 'Paiement refusé',
        message: e instanceof Error ? e.message : 'La recharge a échoué.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <PageTitle title="Recharger" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 3 ? 'Recharge confirmée' : 'Recharger mes crédits'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Solde actuel */}
      {step < 3 && (
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Solde actuel</Text>
          <Text style={styles.balanceValue}>{(user?.bdeCredits ?? 0).toFixed(2)}€</Text>
        </View>
      )}

      {/* Progress */}
      {step < 3 && (
        <View style={styles.progressRow}>
          {[1, 2].map((s) => (
            <View key={s} style={[styles.progressBar, s <= step && styles.progressBarActive]} />
          ))}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── STEP 1 : Montant ─── */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Choisissez un montant</Text>
            <Text style={styles.stepSub}>Les crédits sont utilisables pour tous les billets MyBDE.</Text>

            <View style={styles.amountsGrid}>
              {AMOUNTS.map((a) => {
                const selected = selectedAmount === a.value;
                return (
                  <Pressable
                    key={a.value}
                    style={[styles.amountCard, selected && styles.amountCardSelected]}
                    onPress={() => setSelectedAmount(a.value)}
                  >
                    <View style={styles.amountCheck}>
                      {selected
                        ? <Ionicons name="checkmark-circle" size={18} color={AppColors.primary} />
                        : <View style={styles.amountCheckEmpty} />}
                    </View>
                    <Text style={styles.amountValue}>{a.label}</Text>
                    <Text style={styles.amountHint}>{a.hint}</Text>
                    {a.value === 20 && <Text style={styles.popularBadge}>Populaire</Text>}
                  </Pressable>
                );
              })}
            </View>

            <Card variant="filled" style={styles.recap}>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Montant sélectionné</Text>
                <Text style={styles.recapValue}>{selectedAmount}€</Text>
              </View>
              <View style={[styles.recapRow, styles.recapTotal]}>
                <Text style={styles.recapTotalLabel}>Nouveau solde estimé</Text>
                <Text style={styles.recapTotalValue}>
                  {((user?.bdeCredits ?? 0) + selectedAmount).toFixed(2)}€
                </Text>
              </View>
            </Card>

            <Button
              title="Continuer vers le paiement"
              onPress={() => setStep(2)}
              fullWidth
              size="lg"
            />
          </>
        )}

        {/* ─── STEP 2 : Paiement ─── */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Paiement</Text>

            <Card variant="outlined" style={styles.orderCard}>
              <View style={styles.orderRow}>
                <Ionicons name="wallet-outline" size={18} color={AppColors.primary} />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>Recharge de crédits BDE</Text>
                  <Text style={styles.orderDetail}>+{selectedAmount}€ sur votre solde</Text>
                </View>
                <Text style={styles.orderAmount}>{selectedAmount}€</Text>
              </View>
            </Card>

            <Text style={styles.payLabel}>Moyen de paiement</Text>

            <View style={[styles.payOption, styles.payOptionSelected]}>
              <Ionicons name="card" size={20} color={AppColors.primary} />
              <Text style={styles.payOptionLabel}>Carte (Stripe)</Text>
              <View style={styles.payCheck}>
                <Ionicons name="checkmark" size={14} color={AppColors.white} />
              </View>
            </View>

            <View style={[styles.payOption, styles.payOptionDisabled]}>
              <Ionicons name="logo-apple" size={20} color={AppColors.textLight} />
              <Text style={[styles.payOptionLabel, styles.payOptionLabelDisabled]}>Apple Pay</Text>
              <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>Bientôt</Text></View>
            </View>

            <View style={[styles.payOption, styles.payOptionDisabled]}>
              <Ionicons name="logo-google" size={20} color={AppColors.textLight} />
              <Text style={[styles.payOptionLabel, styles.payOptionLabelDisabled]}>Google Pay</Text>
              <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>Bientôt</Text></View>
            </View>

            <Text style={[styles.payLabel, { marginTop: Spacing.lg }]}>Détails de la carte</Text>
            {__DEV__ ? (
              <Card variant="outlined" style={styles.cardDetails}>
                <Text style={styles.cardNumber}>4242 4242 4242 4242</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>12/28</Text>
                  <Text style={styles.cardMetaText}>123</Text>
                </View>
              </Card>
            ) : (
              <Card variant="outlined" style={styles.secureCard}>
                <Ionicons name="lock-closed" size={18} color={AppColors.textSecondary} />
                <Text style={styles.secureCardText}>Paiement sécurisé via Stripe</Text>
              </Card>
            )}

            <Button
              title={`Payer ${selectedAmount}€`}
              onPress={handleConfirmPayment}
              loading={isProcessing}
              fullWidth
              size="lg"
              style={{ marginTop: Spacing.xl }}
            />
          </>
        )}

        {/* ─── STEP 3 : Confirmation ─── */}
        {step === 3 && (
          <View style={styles.confirmContainer}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={40} color={AppColors.white} />
            </View>

            <Text style={styles.confirmTitle}>Recharge réussie !</Text>
            <Text style={styles.confirmSub}>+{selectedAmount}€ crédités sur votre compte</Text>

            <Card variant="filled" style={styles.confirmCard}>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Montant rechargé</Text>
                <Text style={styles.confirmValueGreen}>+{selectedAmount}€</Text>
              </View>
              <View style={[styles.recapRow, styles.recapTotal]}>
                <Text style={styles.recapTotalLabel}>Nouveau solde</Text>
                <Text style={styles.recapTotalValue}>{(user?.bdeCredits ?? 0).toFixed(2)}€</Text>
              </View>
            </Card>

            <Button title="Terminé" onPress={() => router.back()} fullWidth size="lg" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.text,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.primaryLight,
  },
  balanceLabel: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: AppColors.primary,
  },
  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: AppColors.borderLight,
  },
  progressBarActive: {
    backgroundColor: AppColors.primary,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  stepTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.text,
  },
  stepSub: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  amountCard: {
    width: '47.5%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    padding: Spacing.base,
    minHeight: 96,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  amountCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  amountCheck: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  amountCheckEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  amountValue: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: AppColors.text,
  },
  amountHint: {
    fontSize: FontSizes.xs,
    color: AppColors.textSecondary,
  },
  popularBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: AppColors.primary,
  },
  recap: {
    gap: Spacing.sm,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recapLabel: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
  recapValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.text,
  },
  recapTotal: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  recapTotalLabel: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: AppColors.text,
  },
  recapTotalValue: {
    fontSize: FontSizes.base,
    fontWeight: '800',
    color: AppColors.primary,
  },
  orderCard: {
    padding: Spacing.base,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
  },
  orderDetail: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 1,
  },
  orderAmount: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
  },
  payLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.text,
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  payOptionSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  payOptionDisabled: {
    opacity: 0.6,
    backgroundColor: AppColors.surface,
  },
  payOptionLabel: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: '500',
    color: AppColors.text,
  },
  payOptionLabelDisabled: {
    color: AppColors.textLight,
  },
  payCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  cardDetails: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  cardNumber: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    fontFamily: 'monospace',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  cardMetaText: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    fontFamily: 'monospace',
  },
  secureCard: {
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  secureCardText: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
  },
  confirmContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.lg,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: AppColors.text,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  confirmCard: {
    width: '100%',
    gap: Spacing.sm,
  },
  confirmValueGreen: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: AppColors.success,
  },
});
