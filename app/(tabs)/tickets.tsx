import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import QRCodeGenerator from 'qrcode';
import { router } from 'expo-router';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { JoinBdeBanner } from '@/components/JoinBdeBanner';
import { AttendeesManager } from '@/components/AttendeesManager';
import { AppColors, FontFamily, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useRefreshWhenStale } from '@/hooks/use-refresh-when-stale';
import type { Ticket, Event } from '@/types';

export default function TicketsScreen() {
  const { user } = useAuth();

  // Un admin BDE ne gère pas de billets perso : cet onglet devient l'outil de
  // confirmation des présences (scan QR caméra + code) sur ses événements.
  if (user?.role === 'admin_bde') {
    return <AdminPresenceScreen />;
  }
  return <StudentTicketsScreen />;
}

function StudentTicketsScreen() {
  const { user, refreshUser } = useAuth();
  const dialog = useDialog();
  const [expandedQR, setExpandedQR] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setTickets(await api.getTickets());
    } catch (e) {
      console.error('Erreur chargement billets:', e);
    }
  }, []);

  useEffect(() => {
    loadTickets().finally(() => setLoading(false));
  }, [loadTickets]);

  // Un billet acheté depuis un autre écran doit apparaître ici au retour.
  useRefreshWhenStale(loadTickets);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  }, [loadTickets]);

  const upcomingTickets = tickets.filter((t) => t.status === 'valid');
  const pastTickets = tickets.filter((t) => t.status === 'used');
  const cancelledTickets = tickets.filter((t) => t.status === 'cancelled');
  const nextTicket = upcomingTickets[0];
  const otherTickets = upcomingTickets.slice(1);

  const handleShare = async (ticket: Ticket) => {
    const message = `Mon billet pour ${ticket.eventTitle}\nDate : ${formatShortDate(ticket.eventDate)}\nLieu : ${ticket.eventLocation}\nN° ${ticket.ticketNumber}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: `Billet — ${ticket.eventTitle}`, text: message });
      } else {
        await Share.share({ title: `Billet — ${ticket.eventTitle}`, message });
      }
    } catch {
      dialog.alert({ title: 'Erreur', message: 'Impossible de partager le billet.' });
    }
  };

  const handleExportPDF = async (ticket: Ticket) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // La fenêtre doit être ouverte de façon synchrone dans le gestionnaire de
      // clic, sinon les navigateurs la bloquent comme popup non sollicitée.
      const w = (window as any).open('', '_blank');
      if (!w) {
        dialog.alert({ title: 'Erreur', message: 'Le popup a été bloqué.' });
        return;
      }

      // QR généré localement en data URI. L'ancienne version passait par
      // api.qrserver.com : le moindre blocage réseau (bloqueur de contenu,
      // réseau filtré, hors ligne) produisait un billet sans QR, imprimé
      // silencieusement puisque l'échec de chargement déclenchait quand même
      // l'impression.
      let qrUrl: string;
      try {
        qrUrl = await QRCodeGenerator.toDataURL(ticket.qrCode, {
          width: 250,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
      } catch {
        w.close();
        dialog.alert({
          title: 'Erreur',
          message: "Le QR code n'a pas pu être généré. Le billet n'a pas été exporté.",
        });
        return;
      }

      w.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Billet — ${ticket.eventTitle}</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; background: #f5f7fa; }
            .ticket { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            h1 { font-size: 24px; margin: 0 0 8px; color: #1a1a2e; }
            .meta { color: #6b7280; margin-bottom: 24px; }
            .number { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
            .qr { background: #f5f7fa; padding: 20px; border-radius: 12px; text-align: center; font-family: monospace; word-break: break-all; }
            .footer { margin-top: 24px; text-align: center; color: #9ca3af; font-size: 12px; }
            @media print { body { background: #fff; } .ticket { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h1>${escapeHtml(ticket.eventTitle)}</h1>
            <div class="meta">${escapeHtml(formatShortDate(ticket.eventDate))} · ${escapeHtml(ticket.eventLocation)}</div>
            <div class="number">N° ${escapeHtml(ticket.ticketNumber)}</div>
            <img id="qr" src="${qrUrl}" alt="QR Code" style="display:block;margin:0 auto 16px;" />
            <div class="footer">Billet MyBDE — présentez ce QR code à l'entrée</div>
          </div>
          <script>
            const img = document.getElementById('qr');
            function doPrint() { setTimeout(function() { window.print(); }, 200); }
            if (img.complete) { doPrint(); } else { img.onload = doPrint; img.onerror = doPrint; }
          </script>
        </body>
        </html>
      `);
      w.document.close();
      w.focus();
      return;
    }

    // Fallback natif : partage le billet sous forme de texte
    handleShare(ticket).catch(() => dialog.alert({ title: 'Erreur', message: 'Impossible d\'exporter le billet.' }));
  };

  const handleCancelTicket = (ticket: Ticket) => {
    dialog.confirm({
      title: 'Annuler le billet',
      message: 'Êtes-vous sûr de vouloir annuler ce billet ? Cette action est définitive.',
      confirmText: 'Oui, annuler',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.cancelTicket(ticket.id);
          await loadTickets();
          await refreshUser();
          dialog.alert({ title: 'Annulé', message: 'Votre billet a été annulé et remboursé.' });
        } catch (e) {
          dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Annulation impossible' });
        }
      },
    });
  };

  const handleRecharge = () => router.push('/recharge');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Billets" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes billets</Text>
        </View>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        )}

        {/* Billets déjà achetés (même pour un BDE quitté depuis) : historique
            toujours affiché. Sans BDE rejoint, on incite en plus à en rejoindre. */}
        {!loading && (user?.bdeMembers.length ?? 0) === 0 && (
          <JoinBdeBanner message="Rejoins un BDE pour pouvoir acheter des billets à ses événements." />
        )}

        {!loading && tickets.length === 0 && (
          <View style={styles.loadingBox}>
            <Ionicons name="ticket-outline" size={48} color={AppColors.textLight} />
            <Text style={styles.emptyText}>Aucun billet pour le moment</Text>
          </View>
        )}

        {/* BDE Credits Card */}
        <Card style={styles.creditsCard} padding={Spacing.base}>
          <View style={styles.creditsRow}>
            <View style={styles.creditsLeft}>
              <View style={styles.creditsIcon}>
                <Ionicons name="wallet" size={20} color={AppColors.white} />
              </View>
              <View>
                <Text style={styles.creditsLabel}>CRÉDITS BDE</Text>
                <Text style={styles.creditsAmount}>
                  {(user?.bdeCredits ?? 0).toFixed(2)}€
                </Text>
              </View>
            </View>
            <Button title="Recharger" onPress={handleRecharge} size="sm" icon={<Ionicons name="add-circle-outline" size={16} color={AppColors.white} />} />
          </View>
        </Card>

        {/* Next Event - Featured */}
        {nextTicket && (
          <>
            <Text style={styles.sectionLabel}>PROCHAIN ÉVÉNEMENT</Text>
            <Card style={styles.featuredTicketCard} padding={0}>
              {/* Ticket Header */}
              <View style={styles.ticketHeader}>
                <View style={styles.ticketHeaderInfo}>
                  <Text style={styles.ticketEventName}>{nextTicket.eventTitle}</Text>
                  <Text style={styles.ticketDate}>
                    {formatTicketDate(nextTicket.eventDate)}
                  </Text>
                </View>
                <Badge label={nextTicket.ticketType} variant="info" size="sm" />
              </View>

              {/* QR Code Area - Always visible for next event */}
              <View style={styles.qrSectionLarge}>
                <View style={styles.qrLargeContainer}>
                  <QRCode
                    value={nextTicket.qrCode}
                    size={180}
                    color={AppColors.text}
                    backgroundColor={AppColors.white}
                  />
                </View>
                <Text style={styles.qrCodeText}>N° {nextTicket.ticketNumber}</Text>
                {nextTicket.seatInfo && (
                  <Text style={styles.seatInfo}>{nextTicket.seatInfo}</Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.ticketActions}>
                <Pressable
                  style={styles.ticketActionBtn}
                  onPress={() => {
                    handleExportPDF(nextTicket).catch(() =>
                      dialog.alert({ title: 'Erreur', message: "Impossible d'exporter le billet." }),
                    );
                  }}
                >
                  <Ionicons name="download-outline" size={18} color={AppColors.text} />
                  <Text style={styles.ticketActionText}>PDF</Text>
                </Pressable>
                <Pressable
                  style={styles.ticketActionBtn}
                  onPress={() => handleShare(nextTicket)}
                >
                  <Ionicons name="share-outline" size={18} color={AppColors.text} />
                  <Text style={styles.ticketActionText}>Partager</Text>
                </Pressable>
                <Pressable
                  style={[styles.ticketActionBtn, styles.ticketActionDanger]}
                  onPress={() => handleCancelTicket(nextTicket)}
                >
                  <Ionicons name="close-circle-outline" size={18} color={AppColors.danger} />
                  <Text style={[styles.ticketActionText, styles.ticketActionTextDanger]}>Annuler</Text>
                </Pressable>
              </View>

              <Text style={styles.ticketTip}>
                Présentez ce QR code à l&apos;entrée de l&apos;événement
              </Text>
            </Card>
          </>
        )}

        {/* Other Upcoming Events - Accordion */}
        {otherTickets.length > 0 && (
          <>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => toggleSection('upcoming')}
            >
              <Text style={styles.accordionTitle}>
                Autres événements ({otherTickets.length})
              </Text>
              <Ionicons
                name={expandedSection === 'upcoming' ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={AppColors.text}
              />
            </Pressable>

            {expandedSection === 'upcoming' && (
              <View style={styles.accordionContent}>
                {otherTickets.map((ticket) => (
                  <Card key={ticket.id} style={styles.smallTicketCard}>
                    <View style={styles.smallTicketRow}>
                      <View style={styles.smallTicketInfo}>
                        <Text style={styles.smallTicketTitle} numberOfLines={1}>
                          {ticket.eventTitle}
                        </Text>
                        <Text style={styles.smallTicketDate}>
                          {formatShortDate(ticket.eventDate)} · {ticket.ticketType}
                        </Text>
                      </View>
                      <View style={styles.smallTicketActions}>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => setExpandedQR(expandedQR === ticket.id ? null : ticket.id)}
                        >
                          <Ionicons name="qr-code" size={20} color={AppColors.primary} />
                        </Pressable>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => handleShare(ticket)}
                        >
                          <Ionicons name="share-outline" size={20} color={AppColors.text} />
                        </Pressable>
                      </View>
                    </View>

                    {expandedQR === ticket.id && (
                      <View style={styles.smallTicketQR}>
                        <QRCode
                          value={ticket.qrCode}
                          size={120}
                          color={AppColors.text}
                          backgroundColor={AppColors.white}
                        />
                        <Text style={styles.smallTicketQRText}>{ticket.ticketNumber}</Text>
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            )}
          </>
        )}

        {/* Past Events - Accordion at bottom */}
        {pastTickets.length > 0 && (
          <>
            <Pressable
              style={[styles.accordionHeader, { marginTop: Spacing.xl }]}
              onPress={() => toggleSection('past')}
            >
              <Text style={styles.accordionTitle}>
                Historique ({pastTickets.length})
              </Text>
              <Ionicons
                name={expandedSection === 'past' ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={AppColors.text}
              />
            </Pressable>

            {expandedSection === 'past' && (
              <View style={styles.accordionContent}>
                {pastTickets.map((ticket) => (
                  <View key={ticket.id} style={styles.pastRow}>
                    <Avatar name={ticket.eventTitle} size={46} />
                    <View style={styles.pastInfo}>
                      <Text style={styles.pastTitle} numberOfLines={1}>{ticket.eventTitle}</Text>
                      <Text style={styles.pastMeta}>
                        {formatShortDate(ticket.eventDate)} · {ticket.ticketType}
                      </Text>
                    </View>
                    <Badge label="Passé" variant="neutral" size="sm" />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Cancelled Events - Accordion */}
        {cancelledTickets.length > 0 && (
          <>
            <Pressable
              style={[styles.accordionHeader, { marginTop: Spacing.xl }]}
              onPress={() => toggleSection('cancelled')}
            >
              <Text style={styles.accordionTitle}>
                Annulés ({cancelledTickets.length})
              </Text>
              <Ionicons
                name={expandedSection === 'cancelled' ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={AppColors.text}
              />
            </Pressable>

            {expandedSection === 'cancelled' && (
              <View style={styles.accordionContent}>
                {cancelledTickets.map((ticket) => (
                  <Card key={ticket.id} style={styles.smallTicketCard}>
                    <View style={styles.smallTicketRow}>
                      <View style={styles.smallTicketInfo}>
                        <Text style={styles.smallTicketTitle} numberOfLines={1}>
                          {ticket.eventTitle}
                        </Text>
                        <Text style={styles.smallTicketDate}>
                          {formatShortDate(ticket.eventDate)} · {ticket.ticketType}
                        </Text>
                      </View>
                      <Badge label="Annulé" variant="danger" size="sm" />
                    </View>

                    <View style={[styles.smallTicketQR, { opacity: 0.5 }]}>
                      <QRCode
                        value={ticket.qrCode}
                        size={120}
                        color={AppColors.text}
                        backgroundColor={AppColors.white}
                      />
                      <Text style={styles.smallTicketQRText}>{ticket.ticketNumber}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView >
  );
}

// ─── Écran Présence (admin BDE) ────────────────────────────

function AdminPresenceScreen() {
  const dialog = useDialog();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminEvents({ limit: 50 })
      .then((res) => setEvents(res.events))
      .catch((e) => console.error('Erreur événements présence:', e))
      .finally(() => setLoading(false));
  }, []);

  // Uniquement les événements à venir (non passés) du BDE, du plus proche au
  // plus lointain. Un événement passé n'a plus de présence à confirmer.
  const upcoming = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return events
      .filter((e) => e.status !== 'completed' && new Date(e.date).getTime() >= startOfToday.getTime())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  // Présélection sur le prochain événement à venir.
  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && upcoming.some((e) => e.id === prev)) return prev;
      return upcoming[0]?.id ?? null;
    });
  }, [upcoming]);

  const selectedEvent = upcoming.find((e) => e.id === selectedId) ?? null;

  const openEventPicker = () => {
    dialog.choose({
      title: 'Choisir un événement',
      choices: upcoming.map((ev) => ({
        text: `${ev.title} — ${formatShortDate(ev.date)}`,
        onPress: () => setSelectedId(ev.id),
      })),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Présence" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Présence</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : upcoming.length === 0 ? (
        <View style={styles.loadingBox}>
          <Ionicons name="calendar-outline" size={48} color={AppColors.textLight} />
          <Text style={styles.emptyText}>Aucun événement à venir</Text>
        </View>
      ) : (
        <View style={styles.presenceBody}>
          <Text style={styles.presenceHint}>Sélectionnez un événement puis scannez ou saisissez le code des billets.</Text>
          <View style={styles.presenceSelectWrap}>
            <Pressable style={styles.presenceSelect} onPress={openEventPicker}>
              <View style={{ flex: 1 }}>
                <Text style={styles.presenceSelectLabel}>Événement</Text>
                <Text style={styles.presenceSelectValue} numberOfLines={1}>
                  {selectedEvent ? `${selectedEvent.title} · ${formatShortDate(selectedEvent.date)}` : 'Choisir…'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={AppColors.textSecondary} />
            </Pressable>
          </View>
          {selectedId && (
            <View style={styles.presenceManager}>
              <AttendeesManager eventId={selectedId} dialog={dialog} />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatTicketDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }) + ' · 20h00';
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Échappe une valeur avant interpolation dans le HTML du billet imprimable.
 * Les titres et lieux d'événement viennent de l'API : sans échappement, ils
 * seraient interprétés comme du balisage dans la fenêtre d'impression.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.text,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
  },

  // Présence (admin BDE)
  presenceBody: {
    flex: 1,
  },
  presenceHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  presenceSelectWrap: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  presenceSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minHeight: 52,
  },
  presenceSelectLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
  },
  presenceSelectValue: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: FontSizes.base,
    color: AppColors.text,
    marginTop: 1,
  },
  presenceManager: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },

  // Credits
  creditsCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: AppColors.primaryLight,
    borderWidth: 1,
    borderColor: AppColors.primary + '30',
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  creditsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textSecondary,
    letterSpacing: 0.5,
  },
  creditsAmount: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: AppColors.text,
  },

  // Section
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textLight,
    letterSpacing: 1,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Ticket Card
  ticketCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.base,
    backgroundColor: AppColors.primary,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  ticketHeaderInfo: {
    flex: 1,
  },
  ticketEventName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.white,
    marginBottom: 2,
  },
  ticketDate: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
  },

  // QR
  qrSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: AppColors.surface,
  },
  qrContainer: {
    padding: Spacing.md,
  },
  qrPlaceholder: {
    width: 140,
    height: 140,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
  },
  qrExpanded: {
    width: 200,
    height: 200,
  },
  qrHint: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
  },

  // Ticket Actions
  ticketActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
  },
  ticketActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  ticketActionText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: AppColors.text,
  },
  ticketTip: {
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
    textAlign: 'center',
    paddingBottom: Spacing.md,
  },

  // Past Events
  pastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
  },
  viewAll: {
    fontSize: FontSizes.sm,
    color: AppColors.primary,
    fontWeight: '600',
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  pastInfo: {
    flex: 1,
  },
  pastTitle: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
  },
  pastMeta: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 2,
  },

  // Featured Ticket (Next Event)
  featuredTicketCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.lg,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
  },
  qrSectionLarge: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.xl,
  },
  qrLargeContainer: {
    padding: Spacing.md,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.md,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
  },
  qrCodeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
  },
  seatInfo: {
    fontSize: FontSizes.xs,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  ticketActionDanger: {
    borderColor: AppColors.danger,
  },
  ticketActionTextDanger: {
    color: AppColors.danger,
  },

  // Accordion
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.xl,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  accordionTitle: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
  },
  accordionContent: {
    paddingHorizontal: Spacing.xl,
  },

  // Small Ticket Card (Accordion items)
  smallTicketCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.base,
  },
  smallTicketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallTicketInfo: {
    flex: 1,
  },
  smallTicketTitle: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 2,
  },
  smallTicketDate: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
  smallTicketActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallTicketQR: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
  },
  smallTicketQRText: {
    fontSize: FontSizes.xs,
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
  },
});
