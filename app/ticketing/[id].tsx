import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/PageTitle';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useTransition } from '@/context/TransitionContext';
import { api } from '@/services/api';
import type { Event } from '@/types';

type Step = 1 | 2 | 3;
type PaymentMethod = 'card' | 'balance';

export default function TicketingScreen() {
  const { id, quantity: quantityParam } = useLocalSearchParams<{ id: string; quantity?: string }>();
  const { user, refreshUser } = useAuth();
  const dialog = useDialog();
  const { markDirty } = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [quantity, setQuantity] = useState(() => {
    const q = parseInt(quantityParam ?? '1', 10);
    return Number.isFinite(q) && q > 0 ? Math.min(q, 10) : 1;
  });
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.displayName);
      setEmail((prev) => prev || user.email);
    }
  }, [user]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api
      .getEvent(id)
      .then((e) => {
        if (!active) return;
        setEvent(e);
        setSelectedTierId(e.ticketTiers[0]?.id ?? null);
      })
      .catch((e) => console.error('Erreur chargement événement:', e))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </SafeAreaView>
    );
  }
  if (!event) return null;

  const selectedTier = event.ticketTiers.find((t) => t.id === selectedTierId) ?? event.ticketTiers[0] ?? null;
  const price = selectedTier?.price ?? 0;
  const bookingFee = price > 0 ? 0.5 : 0;
  const total = price * quantity + bookingFee;
  const balance = user?.bdeCredits ?? 0;
  const balanceInsufficient = balance < total;

  const handlePayment = async () => {
    if (!event || !selectedTier) return;
    if (paymentMethod === 'balance' && balanceInsufficient) {
      dialog.alert({
        title: 'Solde insuffisant',
        message: `Votre solde (${balance.toFixed(2)}€) ne couvre pas ${total.toFixed(2)}€. Rechargez vos crédits ou payez par carte.`,
      });
      return;
    }
    setIsProcessing(true);
    try {
      const result = await api.purchaseTicket(
        event.id,
        quantity,
        selectedTier.id,
        paymentMethod,
      );
      setOrderNumber(result.order.id);
      if (paymentMethod === 'balance') await refreshUser();
      markDirty();
      setStep(3);
    } catch (e) {
      const message = e instanceof Error ? e.message : "L'achat a échoué";
      dialog.alert({ title: 'Paiement refusé', message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <PageTitle title="Billetterie" />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 3 ? 'Confirmé !' : `Étape ${step} sur 3`}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      {step < 3 && (
        <View style={styles.progressRow}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.progressDot, s <= step && styles.progressDotActive]}
            />
          ))}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── STEP 1: Ticket Info ─── */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Informations billet</Text>
            <Text style={styles.eventName}>{event.title}</Text>
            <Text style={styles.eventDate}>
              {formatDate(event.date)} · {event.startTime}
            </Text>

            {/* Quantity */}
            <Text style={styles.label}>Quantité</Text>
            <View style={styles.quantityRow}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={20} color={AppColors.text} />
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable
                style={[styles.qtyBtn, styles.qtyBtnPlus]}
                onPress={() => setQuantity(Math.min(10, quantity + 1))}
              >
                <Ionicons name="add" size={20} color={AppColors.white} />
              </Pressable>
              <Text style={styles.spotsHint}>
                ({event.capacity - event.currentAttendees} places restantes)
              </Text>
            </View>

            {/* Ticket Type */}
            {event.ticketTiers.length > 0 ? (
              <>
                <Text style={styles.label}>Type de billet</Text>
                {event.ticketTiers.map((tier) => (
                  <Pressable
                    key={tier.id}
                    style={[styles.radioRow, selectedTierId === tier.id && styles.radioActive]}
                    onPress={() => setSelectedTierId(tier.id)}
                  >
                    <View style={[styles.radio, selectedTierId === tier.id && styles.radioChecked]} />
                    <Text style={styles.radioLabel}>{tier.name}</Text>
                    <Text style={styles.radioPrice}>
                      {tier.price > 0 ? `€${tier.price.toFixed(2)}` : 'Gratuit'}
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : (
              <Text style={styles.label}>Aucun tarif disponible pour cet événement</Text>
            )}

            {/* Name & Email */}
            <Input
              label="Nom complet"
              placeholder="Nom et prénom"
              value={name}
              onChangeText={setName}
              icon="person-outline"
            />
            <Input
              label="E-mail"
              placeholder="bilel@mybde.fr"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            {/* Summary */}
            <Card variant="filled" style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Récapitulatif</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {quantity} x {selectedTier?.name ?? 'Standard'}
                </Text>
                <Text style={styles.summaryValue}>€{(price * quantity).toFixed(2)}</Text>
              </View>
              {bookingFee > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Frais de réservation</Text>
                    <Text style={styles.summaryValue}>€{bookingFee.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.feeHint}>
                    Frais de service MyBDE ({bookingFee.toFixed(2)}€ par commande) :
                    ils couvrent les coûts de transaction et le fonctionnement de
                    la plateforme. Ce montant est inclus dans le total débité.
                  </Text>
                </>
              )}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>€{total.toFixed(2)}</Text>
              </View>
            </Card>

            <Button
              title="Continuer"
              onPress={() => setStep(2)}
              fullWidth
              size="lg"
              disabled={!name.trim() || !email.trim() || !selectedTier}
            />
          </>
        )}

        {/* ─── STEP 2: Payment ─── */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Paiement</Text>

            <Card variant="outlined" style={styles.orderSummary}>
              <Text style={styles.orderTitle}>{event.title}</Text>
              <Text style={styles.orderDetail}>
                {quantity} x {selectedTier?.name ?? 'Standard'} · {total.toFixed(2)}€
              </Text>
            </Card>

            <Text style={styles.label}>Moyen de paiement</Text>

            <Pressable
              style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentSelected]}
              onPress={() => setPaymentMethod('card')}
            >
              <Ionicons name="card" size={20} color={paymentMethod === 'card' ? AppColors.primary : AppColors.text} />
              <Text style={styles.paymentLabel}>Carte (Stripe)</Text>
              {paymentMethod === 'card' && (
                <View style={styles.paymentCheck}>
                  <Ionicons name="checkmark" size={14} color={AppColors.white} />
                </View>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.paymentOption,
                paymentMethod === 'balance' && styles.paymentSelected,
                balanceInsufficient && styles.paymentDisabled,
              ]}
              onPress={() => !balanceInsufficient && setPaymentMethod('balance')}
              disabled={balanceInsufficient}
            >
              <Ionicons name="wallet" size={20} color={paymentMethod === 'balance' ? AppColors.primary : AppColors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentLabel}>Mon solde</Text>
                <Text style={styles.paymentSub}>
                  {balance.toFixed(2)}€ disponibles
                  {balanceInsufficient ? ' · insuffisant' : ''}
                </Text>
              </View>
              {paymentMethod === 'balance' && !balanceInsufficient && (
                <View style={styles.paymentCheck}>
                  <Ionicons name="checkmark" size={14} color={AppColors.white} />
                </View>
              )}
            </Pressable>

            <View style={[styles.paymentOption, styles.paymentDisabled]}>
              <Ionicons name="logo-apple" size={20} color={AppColors.textLight} />
              <Text style={[styles.paymentLabel, styles.paymentLabelDisabled]}>Apple Pay</Text>
              <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>Bientôt</Text></View>
            </View>

            <View style={[styles.paymentOption, styles.paymentDisabled]}>
              <Ionicons name="logo-google" size={20} color={AppColors.textLight} />
              <Text style={[styles.paymentLabel, styles.paymentLabelDisabled]}>Google Pay</Text>
              <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>Bientôt</Text></View>
            </View>

            {/* Détails carte (paiement par carte). Les numéros de carte de test
                ne sont visibles qu'en environnement de développement ; en prod
                un message neutre est affiché à la place. */}
            {paymentMethod === 'card' && (
              <>
                <Text style={[styles.label, { marginTop: Spacing.lg }]}>Détails de la carte</Text>
                {__DEV__ ? (
                  <Card variant="outlined" style={styles.mockCard}>
                    <Text style={styles.mockCardText}>4242 4242 4242 4242</Text>
                    <View style={styles.mockCardRow}>
                      <Text style={styles.mockCardText}>12/28</Text>
                      <Text style={styles.mockCardText}>123</Text>
                    </View>
                  </Card>
                ) : (
                  <Card variant="outlined" style={styles.secureCard}>
                    <Ionicons name="lock-closed" size={18} color={AppColors.textSecondary} />
                    <Text style={styles.secureCardText}>Paiement sécurisé via Stripe</Text>
                  </Card>
                )}
              </>
            )}

            <Button
              title={
                paymentMethod === 'balance'
                  ? `Payer ${total.toFixed(2)}€ avec mon solde`
                  : `Payer ${total.toFixed(2)}€`
              }
              onPress={handlePayment}
              loading={isProcessing}
              fullWidth
              size="lg"
              style={{ marginTop: Spacing.xl }}
            />
          </>
        )}

        {/* ─── STEP 3: Confirmation ─── */}
        {step === 3 && (
          <View style={styles.confirmationContainer}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={48} color={AppColors.white} />
            </View>

            <Text style={styles.confirmTitle}>Billet confirmé !</Text>
            <Text style={styles.confirmSub}>
              Commande #{orderNumber ?? '—'}
            </Text>
            <Text style={styles.confirmEmail}>
              Confirmation envoyée à : {email || 'votre e-mail'}
            </Text>

            <Card style={styles.confirmCard}>
              <Text style={styles.confirmEventName}>{event.title}</Text>
              <Text style={styles.confirmEventDate}>
                {formatDate(event.date)} · {event.startTime}
              </Text>
              <Text style={styles.confirmEventLoc}>{event.location}</Text>

              <View style={styles.qrArea}>
                <View style={styles.qrBox}>
                  <Ionicons name="qr-code" size={100} color={AppColors.text} />
                </View>
              </View>
            </Card>

            <Button
              title="Voir mes billets"
              onPress={() => {
                router.dismiss();
                router.push('/(tabs)/tickets');
              }}
              fullWidth
              size="lg"
            />

            <Button
              title="Retour aux événements"
              onPress={() => {
                router.dismiss();
                router.push('/(tabs)/events');
              }}
              variant="outline"
              fullWidth
              size="lg"
              style={{ marginTop: Spacing.md }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.text,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.borderLight,
  },
  progressDotActive: {
    backgroundColor: AppColors.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // Step titles
  stepTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: Spacing.sm,
  },
  eventName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  eventDate: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    marginBottom: Spacing.xl,
  },

  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },

  // Quantity
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPlus: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  qtyText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  spotsHint: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
  },

  // Radio
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    marginBottom: Spacing.sm,
  },
  radioActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: AppColors.border,
  },
  radioChecked: {
    borderWidth: 6,
    borderColor: AppColors.primary,
  },
  radioLabel: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: '500',
    color: AppColors.text,
  },
  radioPrice: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
  },

  // Summary
  summaryCard: {
    marginVertical: Spacing.lg,
    padding: Spacing.base,
  },
  summaryTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
  },
  summaryValue: {
    fontSize: FontSizes.base,
    color: AppColors.text,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
  },
  totalValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
  },

  // Step 2 - Payment
  orderSummary: {
    marginBottom: Spacing.lg,
    padding: Spacing.base,
  },
  orderTitle: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
  },
  orderDetail: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    marginBottom: Spacing.sm,
  },
  paymentSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  paymentLabel: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: '500',
    color: AppColors.text,
  },
  paymentSub: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  paymentDisabled: {
    opacity: 0.6,
    backgroundColor: AppColors.surface,
  },
  paymentLabelDisabled: {
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
  paymentCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeHint: {
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  mockCard: {
    padding: Spacing.base,
    gap: Spacing.sm,
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
  mockCardText: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    fontFamily: 'monospace',
  },
  mockCardRow: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },

  // Step 3 - Confirmation
  confirmationContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  confirmTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: AppColors.text,
    marginBottom: Spacing.sm,
  },
  confirmSub: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
  },
  confirmEmail: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    marginBottom: Spacing.xl,
  },
  confirmCard: {
    width: '100%',
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  confirmEventName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
    textAlign: 'center',
  },
  confirmEventDate: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  confirmEventLoc: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginBottom: Spacing.xl,
  },
  qrArea: {
    alignItems: 'center',
  },
  qrBox: {
    width: 160,
    height: 160,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHint: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    marginTop: Spacing.sm,
  },
});
