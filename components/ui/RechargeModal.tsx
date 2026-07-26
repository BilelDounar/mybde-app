import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AppColors, FontSizes, Spacing, BorderRadius, Gradients } from '@/constants/theme';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';

// ─── Montants prédéfinis ────────────────────────────────────

const AMOUNTS = [
  { value: 5, label: '5€', hint: 'Petit coup de pouce' },
  { value: 10, label: '10€', hint: 'Idéal pour 1 billet' },
  { value: 20, label: '20€', hint: 'Le plus populaire' },
  { value: 50, label: '50€', hint: 'Pour profiter à fond' },
];

// ─── Props ──────────────────────────────────────────────────

interface RechargeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

// ─── Component ─────────────────────────────────────────────

export function RechargeModal({ visible, onClose, onSuccess }: RechargeModalProps) {
  const { user, refreshUser } = useAuth();
  const dialog = useDialog();

  const [selectedAmount, setSelectedAmount] = useState<number>(20);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClose = () => {
    setStep(1);
    setSelectedAmount(20);
    onClose();
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      const updated = await api.rechargeCredits(selectedAmount);
      await refreshUser();
      setStep(3);
      onSuccess?.(updated.bdeCredits ?? 0);
    } catch (e) {
      dialog.alert({
        title: 'Paiement refusé',
        message: e instanceof Error ? e.message : 'La recharge a échoué.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <LinearGradient
                  colors={Gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.headerIcon}
                >
                  <Ionicons name="wallet" size={20} color={AppColors.white} />
                </LinearGradient>
                <View>
                  <Text style={styles.headerTitle}>Recharger mes crédits</Text>
                  <Text style={styles.headerSub}>
                    Solde actuel : <Text style={styles.headerBalance}>{(user?.bdeCredits ?? 0).toFixed(2)}€</Text>
                  </Text>
                </View>
              </View>
              <Pressable style={styles.closeBtn} onPress={handleClose}>
                <Ionicons name="close" size={20} color={AppColors.textSecondary} />
              </Pressable>
            </View>

            {/* Progress */}
            {step < 3 && (
              <View style={styles.progressRow}>
                {[1, 2].map((s) => (
                  <View
                    key={s}
                    style={[styles.progressBar, s <= step && styles.progressBarActive]}
                  />
                ))}
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              {/* ─── STEP 1 : Choisir le montant ─── */}
              {step === 1 && (
                <>
                  <Text style={styles.stepTitle}>Choisissez un montant</Text>
                  <Text style={styles.stepSub}>Les crédits sont utilisables pour tous les billets MyBDE.</Text>

                  <View style={styles.amountsGrid}>
                    {AMOUNTS.map((a) => (
                      <Pressable
                        key={a.value}
                        style={[styles.amountCard, selectedAmount === a.value && styles.amountCardSelected]}
                        onPress={() => setSelectedAmount(a.value)}
                      >
                        {selectedAmount === a.value && (
                          <LinearGradient
                            colors={Gradients.brand}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                          />
                        )}
                        <View style={styles.amountCheck}>
                          {selectedAmount === a.value
                            ? <Ionicons name="checkmark-circle" size={18} color={AppColors.white} />
                            : <View style={styles.amountCheckEmpty} />
                          }
                        </View>
                        <Text style={[styles.amountValue, selectedAmount === a.value && styles.amountValueSelected]}>
                          {a.label}
                        </Text>
                        <Text style={[styles.amountHint, selectedAmount === a.value && styles.amountHintSelected]}>
                          {a.hint}
                        </Text>
                        {a.value === 20 && selectedAmount !== a.value && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularBadgeText}>⭐</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>

                  {/* Récap */}
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

              {/* ─── STEP 2 : Paiement Stripe ─── */}
              {step === 2 && (
                <>
                  <Text style={styles.stepTitle}>Paiement</Text>

                  {/* Récap commande */}
                  <Card variant="outlined" style={styles.orderCard}>
                    <View style={styles.orderRow}>
                      <Ionicons name="wallet-outline" size={18} color={AppColors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderTitle}>Recharge de crédits BDE</Text>
                        <Text style={styles.orderDetail}>+{selectedAmount}€ sur votre solde</Text>
                      </View>
                      <Text style={styles.orderAmount}>{selectedAmount}€</Text>
                    </View>
                  </Card>

                  {/* Méthode de paiement */}
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

                  {/* Détails carte */}
                  <Text style={[styles.payLabel, { marginTop: Spacing.lg }]}>Détails de la carte</Text>
                  {__DEV__ ? (
                    <Card variant="outlined" style={styles.cardDetails}>
                      <View style={styles.cardChip}>
                        <Ionicons name="card-outline" size={16} color={AppColors.textSecondary} />
                        <Text style={styles.cardNumber}>4242 4242 4242 4242</Text>
                      </View>
                      <View style={styles.cardMeta}>
                        <Text style={styles.cardMetaText}>12/28</Text>
                        <Text style={styles.cardMetaText}>123</Text>
                      </View>
                      <View style={styles.devBadge}>
                        <Text style={styles.devBadgeText}>TEST</Text>
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

                  <Pressable onPress={() => setStep(1)} style={styles.backLink}>
                    <Ionicons name="arrow-back" size={14} color={AppColors.textSecondary} />
                    <Text style={styles.backLinkText}>Changer le montant</Text>
                  </Pressable>
                </>
              )}

              {/* ─── STEP 3 : Confirmation ─── */}
              {step === 3 && (
                <View style={styles.confirmContainer}>
                  <LinearGradient
                    colors={Gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.successCircle}
                  >
                    <Ionicons name="checkmark" size={36} color={AppColors.white} />
                  </LinearGradient>

                  <Text style={styles.confirmTitle}>Recharge réussie !</Text>
                  <Text style={styles.confirmSub}>+{selectedAmount}€ crédités sur votre compte</Text>

                  <Card variant="filled" style={styles.confirmCard}>
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmLabel}>Montant rechargé</Text>
                      <Text style={styles.confirmValueGreen}>+{selectedAmount}€</Text>
                    </View>
                    <View style={[styles.confirmRow, styles.confirmRowTotal]}>
                      <Text style={styles.confirmLabelBold}>Nouveau solde</Text>
                      <Text style={styles.confirmValueBold}>
                        {((user?.bdeCredits ?? 0)).toFixed(2)}€
                      </Text>
                    </View>
                  </Card>

                  <Button
                    title="Fermer"
                    onPress={handleClose}
                    fullWidth
                    size="lg"
                  />
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: AppColors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AppColors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.border,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
  },
  headerSub: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 1,
  },
  headerBalance: {
    fontWeight: '700',
    color: AppColors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress
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

  // Body
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
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
    marginTop: -Spacing.sm,
  },

  // Amounts grid
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
    overflow: 'hidden',
    minHeight: 90,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  amountCardSelected: {
    borderColor: AppColors.primary,
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
  amountValueSelected: {
    color: AppColors.white,
  },
  amountHint: {
    fontSize: FontSizes.xs,
    color: AppColors.textSecondary,
  },
  amountHintSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  popularBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
  },
  popularBadgeText: {
    fontSize: 12,
  },

  // Recap
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

  // Step 2 — Payment
  orderCard: {
    padding: Spacing.base,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
    marginTop: Spacing.sm,
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
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
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
  devBadge: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.warningLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  devBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: AppColors.warning,
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  backLinkText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },

  // Step 3 — Confirmation
  confirmContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    marginTop: -Spacing.sm,
  },
  confirmCard: {
    width: '100%',
    gap: Spacing.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmRowTotal: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  confirmLabel: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
  confirmLabelBold: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: AppColors.text,
  },
  confirmValueGreen: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: AppColors.success,
  },
  confirmValueBold: {
    fontSize: FontSizes.base,
    fontWeight: '800',
    color: AppColors.primary,
  },
});
