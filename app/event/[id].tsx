import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AvatarStack } from '@/components/ui/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { AuthGate } from '@/components/AuthGate';
import { LeafletMap } from '@/components/ui/LeafletMap';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { getCategoryMeta } from '@/constants/eventCategories';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { Event, EventParticipant } from '@/types';

// Au-delà de ce seuil, la page adopte une mise en page desktop à deux
// colonnes (contenu à gauche, informations + carte à droite). En dessous,
// la mise en page mobile (colonne unique + barre d'achat fixe) est inchangée.
const DESKTOP_BREAKPOINT = 1024;

export default function EventDetailRoute() {
  return (
    <AuthGate>
      <EventDetailScreen />
    </AuthGate>
  );
}

function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { user } = useAuth();
  const isDesktop = SCREEN_WIDTH >= DESKTOP_BREAKPOINT;
  // Un admin BDE / super admin ne peut pas acheter de billet (il organise et est
  // présent d'office) : l'achat est réservé aux étudiants.
  const purchaseBlocked = user?.role === 'admin_bde' || user?.role === 'super_admin';
  const [quantity, setQuantity] = useState(1);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([
      api.getEvent(id),
      api.getEventParticipants(id).catch(() => []),
    ])
      .then(([e, p]) => {
        if (!active) return;
        setEvent(e);
        setParticipants(p);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={AppColors.textLight} />
          <Text style={styles.errorText}>Événement introuvable</Text>
          <Button title="Retour" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const spotsLeft = event.capacity - event.currentAttendees;
  const fillPercent = (event.currentAttendees / event.capacity) * 100;
  const totalPrice = event.price * quantity;
  const isFree = event.price === 0;

  const handleShare = async () => {
    try {
      await Share.share({
        title: event.title,
        message: `${event.title}\n${formatFullDate(event.date)} à ${event.startTime}\n${event.location}\nOrganisé par ${event.bdeName}`,
      });
    } catch {
      Alert.alert('Erreur', 'Impossible de partager cet événement.');
    }
  };

  const goToTicketing = () =>
    router.push({
      pathname: '/ticketing/[id]',
      params: { id: event.id, quantity: String(quantity) },
    });

  // ─── Blocs partagés entre les mises en page mobile et desktop ─────

  const heroBlock = (
    <View style={[styles.heroImage, { backgroundColor: getCategoryMeta(event.category).heroColor }]}>
      <Ionicons name={getCategoryMeta(event.category).icon} size={60} color="rgba(255,255,255,0.3)" />
      <SafeAreaView style={styles.heroOverlay} edges={['top']}>
        <Pressable style={styles.heroButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={AppColors.text} />
        </Pressable>
        <Pressable style={styles.heroButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={AppColors.text} />
        </Pressable>
      </SafeAreaView>
    </View>
  );

  const tagsAndTitleBlock = (
    <>
      <View style={styles.tagsRow}>
        {event.tags.map((tag) => (
          <Badge key={tag} label={tag} variant="info" size="sm" />
        ))}
      </View>
      <Text style={styles.title}>{event.title}</Text>
    </>
  );

  const participantsBlock = participants.length > 0 && (
    <>
      <Text style={styles.sectionTitle}>Qui participe</Text>
      <View style={styles.attendeesRow}>
        <AvatarStack names={participants.map((p) => p.displayName)} size={36} max={4} />
        <Text style={styles.attendeesText}>
          {event.currentAttendees} participant{event.currentAttendees > 1 ? 's' : ''} inscrit{event.currentAttendees > 1 ? 's' : ''}
        </Text>
      </View>
    </>
  );

  const aboutBlock = (
    <>
      <Text style={styles.sectionTitle}>À propos de l&apos;événement</Text>
      <Text
        style={styles.description}
        numberOfLines={showFullDescription ? undefined : 4}
      >
        {event.description}
      </Text>
      {event.description.length > 150 && (
        <Pressable onPress={() => setShowFullDescription(!showFullDescription)}>
          <Text style={styles.readMore}>
            {showFullDescription ? 'Voir moins' : 'Lire la suite'}
          </Text>
        </Pressable>
      )}
    </>
  );

  const availabilityBlock = (
    <View style={styles.availabilityRow}>
      <View style={styles.availBar}>
        <View style={[styles.availFill, { width: `${Math.min(fillPercent, 100)}%` }]} />
      </View>
      <Text style={styles.availText}>
        {spotsLeft} / {event.capacity} places disponibles
      </Text>
    </View>
  );

  const quantitySelectorBlock = !isFree && (
    <View style={styles.quantitySelector}>
      <Pressable style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
        <Ionicons name="remove" size={18} color={AppColors.text} />
      </Pressable>
      <Text style={styles.qtyText}>{quantity}</Text>
      <Pressable style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={() => setQuantity(Math.min(10, quantity + 1))}>
        <Ionicons name="add" size={18} color={AppColors.white} />
      </Pressable>
    </View>
  );

  // Message affiché à la place de l'achat pour les rôles administrateurs.
  const blockedNotice = (
    <View style={styles.blockedNotice}>
      <Ionicons name="shield-checkmark-outline" size={18} color={AppColors.textSecondary} />
      <Text style={styles.blockedText}>
        Achat réservé aux étudiants. En tant qu&apos;administrateur, vous gérez cet événement.
      </Text>
    </View>
  );

  // Sans `height` : la carte remplit son conteneur (carte carrée du sidebar desktop).
  const mapBlock = (height?: number) => (
    <View style={[styles.mapPreview, height == null && styles.mapPreviewSquare, height != null && { height }]}>
      {event.latitude != null && event.longitude != null ? (
        <LeafletMap latitude={event.latitude} longitude={event.longitude} height={height} />
      ) : (
        <View style={[styles.mapPlaceholder, height == null && styles.mapPlaceholderFill]}>
          <Ionicons name="map" size={40} color={AppColors.textLight} />
          <Text style={styles.mapUnavailableText}>Localisation non disponible</Text>
        </View>
      )}
    </View>
  );

  // ─── Mise en page desktop (≥1024px) : barre fixe + deux colonnes ───
  if (isDesktop) {
    return (
      <View style={styles.container}>
        <PageTitle title={event.title} />

        {/* Barre d'action fixe en haut (reste visible au défilement) */}
        <View style={styles.topBar}>
          <View style={styles.topBarInner}>
            <Pressable style={styles.topBarBtn} onPress={() => router.back()} accessibilityLabel="Retour" hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={AppColors.text} />
            </Pressable>
            <Text style={styles.topBarTitle} numberOfLines={1}>{event.title}</Text>
            <Pressable style={styles.topBarBtn} onPress={handleShare} accessibilityLabel="Partager" hitSlop={8}>
              <Ionicons name="share-outline" size={20} color={AppColors.text} />
            </Pressable>
            {purchaseBlocked ? (
              <Text style={styles.topBarBlocked}>Réservé aux étudiants</Text>
            ) : (
              <View style={styles.topBarBuy}>
                <Text style={styles.topBarPrice}>{isFree ? 'Gratuit' : `${event.price.toFixed(2)}€`}</Text>
                <Button
                  title={isFree ? "S'inscrire" : 'Acheter'}
                  onPress={goToTicketing}
                  size="md"
                  disabled={spotsLeft <= 0}
                />
              </View>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero épuré : couleur de catégorie + dégradé + badge (sans boutons) */}
          <View style={[styles.heroImage, styles.heroImageDesktop, { backgroundColor: getCategoryMeta(event.category).heroColor }]}>
            <Ionicons name={getCategoryMeta(event.category).icon} size={72} color="rgba(255,255,255,0.28)" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroBadgeWrap}>
              <Badge label={event.category.toUpperCase()} variant="primary" />
            </View>
          </View>

          <View style={styles.desktopRow}>
            {/* Colonne gauche : contenu principal */}
            <View style={styles.desktopLeft}>
              {tagsAndTitleBlock}

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="calendar" size={18} color={AppColors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{formatFullDate(event.date)}</Text>
                  <Text style={styles.infoSub}>{event.startTime} - {event.endTime}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="location" size={18} color={AppColors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{event.location}</Text>
                  <Text style={styles.infoSub}>Organisé par {event.bdeName}</Text>
                </View>
              </View>

              <View style={styles.divider} />
              {participantsBlock}
              {participantsBlock && <View style={styles.divider} />}

              {aboutBlock}

              <View style={styles.divider} />
              {availabilityBlock}
            </View>

            {/* Colonne droite : achat (panneau) + informations + carte */}
            <View style={styles.desktopSidebar}>
              <View style={styles.buyCard}>
                {purchaseBlocked ? (
                  blockedNotice
                ) : (
                  <>
                    <View style={styles.priceSection}>
                      <Text style={styles.priceLabel}>BILLETS DISPONIBLES</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceAmount}>
                          {isFree ? 'Gratuit' : `${totalPrice.toFixed(2)}€`}
                        </Text>
                        {!isFree && <Text style={styles.pricePer}> / {quantity > 1 ? `${quantity} pers.` : 'personne'}</Text>}
                      </View>
                    </View>
                    <Text style={styles.buySpots}>{spotsLeft} / {event.capacity} places restantes</Text>
                    {quantitySelectorBlock}
                    <Button
                      title={isFree ? "S'inscrire →" : 'Acheter un billet →'}
                      onPress={goToTicketing}
                      fullWidth
                      size="lg"
                      disabled={spotsLeft <= 0}
                      style={{ marginTop: Spacing.base }}
                    />
                    <View style={styles.stripeBadge}>
                      <Ionicons name="lock-closed" size={12} color={AppColors.textLight} />
                      <Text style={styles.stripeText}>SÉCURISÉ PAR STRIPE</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Informations</Text>
                <View style={styles.infoCardRow}>
                  <Ionicons name="people-outline" size={16} color={AppColors.textSecondary} />
                  <Text style={styles.infoCardText}>{event.bdeName}</Text>
                </View>
                <View style={styles.infoCardRow}>
                  <Ionicons name="calendar-outline" size={16} color={AppColors.textSecondary} />
                  <Text style={styles.infoCardText}>{formatFullDate(event.date)} · {event.startTime}</Text>
                </View>
                <View style={styles.infoCardRow}>
                  <Ionicons name="location-outline" size={16} color={AppColors.textSecondary} />
                  <Text style={styles.infoCardText}>{event.location}</Text>
                </View>
                <View style={styles.infoCardRow}>
                  <Ionicons name="pricetag-outline" size={16} color={AppColors.textSecondary} />
                  <Text style={styles.infoCardText}>{isFree ? 'Gratuit' : `À partir de ${event.price.toFixed(2)}€`}</Text>
                </View>
              </View>
              {mapBlock()}
            </View>
          </View>
          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </View>
    );
  }

  // ─── Mise en page mobile : colonne unique + barre d'achat fixe ─────
  return (
    <View style={styles.container}>
      <PageTitle title={event.title} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {heroBlock}

        <View style={styles.content}>
          {tagsAndTitleBlock}

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar" size={18} color={AppColors.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>{formatFullDate(event.date)}</Text>
              <Text style={styles.infoSub}>{event.startTime} - {event.endTime}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="location" size={18} color={AppColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{event.location}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {participantsBlock}
          {participantsBlock && <View style={styles.divider} />}

          {aboutBlock}

          {mapBlock(160)}

          {availabilityBlock}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarContent}>
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>BILLETS DISPONIBLES</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>
                {isFree ? 'Gratuit' : `${totalPrice.toFixed(2)}€`}
              </Text>
              {!isFree && <Text style={styles.pricePer}> / {quantity > 1 ? `${quantity} pers.` : 'personne'}</Text>}
            </View>
            {/* Places restantes toujours visibles sur mobile */}
            <Text style={[styles.spotsLine, spotsLeft <= 0 && { color: AppColors.danger }]}>
              {spotsLeft > 0 ? `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}` : 'Complet'}
            </Text>
          </View>
          {!purchaseBlocked && quantitySelectorBlock}
        </View>

        {purchaseBlocked ? (
          blockedNotice
        ) : (
          <>
            <Button
              title={isFree ? "S'inscrire →" : 'Acheter un billet →'}
              onPress={goToTicketing}
              fullWidth
              size="lg"
              disabled={spotsLeft <= 0}
            />
            <View style={styles.stripeBadge}>
              <Ionicons name="lock-closed" size={12} color={AppColors.textLight} />
              <Text style={styles.stripeText}>SÉCURISÉ PAR STRIPE</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontSize: FontSizes.md,
    color: AppColors.textSecondary,
  },

  // Barre d'action fixe (desktop)
  topBar: {
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
    zIndex: 10,
  },
  topBarInner: {
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    height: 64,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
  },
  topBarBuy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginLeft: Spacing.sm,
  },
  topBarPrice: {
    fontSize: FontSizes.base,
    fontWeight: '800',
    color: AppColors.text,
    fontVariant: ['tabular-nums'],
  },
  topBarBlocked: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginLeft: Spacing.sm,
  },

  // Blocage achat (rôles admin)
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
  },
  blockedText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  buySpots: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: Spacing.xs,
  },
  spotsLine: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginTop: 2,
  },

  // Hero
  heroImage: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageDesktop: {
    height: 240,
    position: 'relative',
  },
  heroBadgeWrap: {
    position: 'absolute',
    left: Spacing.xxl,
    bottom: Spacing.lg,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  heroButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    backgroundColor: AppColors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    marginTop: -20,
  },

  // Desktop layout (≥1024px) : deux colonnes
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xxl,
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    backgroundColor: AppColors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    marginTop: -20,
  },
  desktopLeft: {
    flex: 1,
    minWidth: 0,
  },
  desktopSidebar: {
    width: 340,
  },
  buyCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
    backgroundColor: AppColors.white,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
    backgroundColor: AppColors.white,
    gap: Spacing.md,
  },
  infoCardTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: Spacing.xs,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoCardText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: AppColors.text,
    marginBottom: Spacing.xl,
    lineHeight: 36,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoLabel: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
  },
  infoSub: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.borderLight,
    marginVertical: Spacing.lg,
  },

  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: Spacing.md,
  },

  // Attendees
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  attendeesText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },

  // Description
  description: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
    lineHeight: 24,
  },
  readMore: {
    fontSize: FontSizes.sm,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },

  // Map
  mapPreview: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  // Carte carrée du sidebar desktop : dimensionnée via aspectRatio plutôt
  // qu'une hauteur fixe, la carte (ou son placeholder) remplit ce carré.
  mapPreviewSquare: {
    position: 'relative',
    aspectRatio: 1,
    width: '100%',
  },
  mapPlaceholder: {
    height: 160,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderFill: {
    ...StyleSheet.absoluteFillObject,
    height: undefined,
  },
  mapUnavailableText: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    marginTop: Spacing.sm,
  },

  // Availability
  availabilityRow: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  availBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.borderLight,
    overflow: 'hidden',
  },
  availFill: {
    height: '100%',
    backgroundColor: AppColors.success,
    borderRadius: 3,
  },
  availText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
    boxShadow: '0px -4px 12px rgba(0, 0, 0, 0.06)',
  },
  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceSection: {},
  priceLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: AppColors.text,
  },
  pricePer: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },

  // Quantity
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
    minWidth: 20,
    textAlign: 'center',
  },

  // Stripe
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  stripeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textLight,
    letterSpacing: 0.5,
  },
});
