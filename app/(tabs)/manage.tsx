import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { AppColors, BorderRadius, FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { EVENT_CATEGORIES } from '@/constants/eventCategories';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useTransition } from '@/context/TransitionContext';
import { api, type EventInput } from '@/services/api';
import type { BDE, Event, BdeMember, AdminUser, NewsPost, AdminSummary } from '@/types';

type Section = 'events' | 'members' | 'users' | 'treasury' | 'content';

const CATEGORIES = EVENT_CATEGORIES.map((c) => ({ value: c.value.toUpperCase(), label: c.label }));
const STATUSES = ['DRAFT', 'PUBLISHED'] as const;
const ROLES = ['STUDENT', 'ADMIN_BDE', 'SUPER_ADMIN'] as const;
const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Étudiant',
  ADMIN_BDE: 'Admin BDE',
  SUPER_ADMIN: 'Super admin',
};

interface TierFormState {
  id?: string;
  name: string;
  price: string;
}

interface EventFormState {
  id?: string;
  bdeId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: string;
  tiers: TierFormState[];
  category: string;
  status: string;
}

const emptyForm = (bdeId: string): EventFormState => ({
  bdeId,
  title: '',
  description: '',
  date: '',
  startTime: '20:00',
  endTime: '23:00',
  location: '',
  capacity: '100',
  tiers: [{ name: 'Standard', price: '0' }],
  category: CATEGORIES[0].value,
  status: 'DRAFT',
});

export default function ManageScreen() {
  const { user } = useAuth();
  const dialog = useDialog();
  const { markDirty } = useTransition();
  const isSuperAdmin = user?.role === 'super_admin';
  const isManager = user?.role === 'admin_bde' || user?.role === 'super_admin';

  const sections: Section[] = isSuperAdmin
    ? ['events', 'users', 'treasury', 'content']
    : ['events', 'members', 'treasury', 'content'];

  const [section, setSection] = useState<Section>('events');
  const [managedBdes, setManagedBdes] = useState<BDE[]>([]);
  const [selectedBdeId, setSelectedBdeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<BdeMember[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<EventFormState>(emptyForm(''));
  const [saving, setSaving] = useState(false);

  const [newsVisible, setNewsVisible] = useState(false);
  const [newsContent, setNewsContent] = useState('');
  const [news, setNews] = useState<NewsPost[]>([]);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);

  const [attendeesVisible, setAttendeesVisible] = useState(false);
  const [attendees, setAttendees] = useState<Array<{
    id: string;
    ticketNumber: string;
    qrCode: string;
    status: string;
    ticketType: string;
    seatInfo?: string | null;
    purchasedAt: string;
    user: { id: string; displayName: string; email: string; profilePicture?: string | null };
  }>>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState('');

  const selectedBde = useMemo(
    () => managedBdes.find((b) => b.id === selectedBdeId) ?? null,
    [managedBdes, selectedBdeId],
  );

  const upcomingEvents = useMemo(() => events.filter((e) => e.status !== 'completed'), [events]);
  const pastEvents = useMemo(() => events.filter((e) => e.status === 'completed'), [events]);

  useEffect(() => {
    api
      .getManagedBdes()
      .then((bdes) => {
        setManagedBdes(bdes);
        if (bdes.length > 0) setSelectedBdeId((prev) => prev || bdes[0].id);
      })
      .catch((e) => console.error('Erreur BDE gérés:', e))
      .finally(() => setLoading(false));
  }, []);

  const loadSection = useCallback(async () => {
    try {
      if (section === 'events') {
        setEvents(await api.getAdminEvents({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        }));
      } else if (section === 'users') {
        setUsers(await api.getUsers({ search: search.trim() || undefined, role: roleFilter || undefined }));
      } else if (section === 'members' && selectedBdeId) {
        setMembers(await api.getBdeMembers(selectedBdeId));
      } else if (section === 'content') {
        setNews(await api.getNews(null, selectedBdeId || undefined, search.trim() || undefined));
      }
    } catch (e) {
      console.error('Erreur chargement gestion:', e);
    }
  }, [section, search, selectedBdeId, statusFilter, categoryFilter, roleFilter]);

  useEffect(() => {
    loadSection();
  }, [loadSection]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.getAdminSummary().then(setSummary).catch((e) => console.error('Erreur compteurs admin:', e));
  }, [isSuperAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSection();
    setRefreshing(false);
  };

  // ─── Événements ──────────────────────────────────────────
  const openCreate = () => {
    setForm(emptyForm(selectedBdeId || managedBdes[0]?.id || ''));
    setFormVisible(true);
  };

  const openEdit = (ev: Event) => {
    setForm({
      id: ev.id,
      bdeId: ev.bdeId,
      title: ev.title,
      description: ev.description,
      date: ev.date ? ev.date.slice(0, 10) : '',
      startTime: ev.startTime || '20:00',
      endTime: ev.endTime || '23:00',
      location: ev.location,
      capacity: String(ev.capacity ?? 100),
      tiers: ev.ticketTiers.length > 0
        ? ev.ticketTiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price) }))
        : [{ name: 'Standard', price: String(ev.price ?? 0) }],
      category: (ev.category || 'autre').toUpperCase(),
      status: (ev.status || 'draft').toUpperCase(),
    });
    setFormVisible(true);
  };

  const submitForm = async () => {
    if (!form.bdeId) {
      dialog.alert({ title: 'BDE requis', message: 'Sélectionnez un BDE organisateur.' });
      return;
    }
    if (!form.title.trim() || !form.date.trim() || !form.location.trim()) {
      dialog.alert({ title: 'Champs manquants', message: 'Titre, date et lieu sont obligatoires.' });
      return;
    }
    const tiers = form.tiers
      .map((t) => ({ name: t.name.trim(), price: parseFloat(t.price) || 0 }))
      .filter((t) => t.name.length > 0);
    if (tiers.length === 0) {
      dialog.alert({ title: 'Tarif requis', message: 'Ajoutez au moins un tarif (ex. Standard).' });
      return;
    }
    const isoDate = `${form.date.trim()}T00:00:00.000Z`;
    if (Number.isNaN(Date.parse(isoDate))) {
      dialog.alert({ title: 'Date invalide', message: 'Utilisez le format AAAA-MM-JJ.' });
      return;
    }
    const payload: EventInput = {
      bdeId: form.bdeId,
      title: form.title.trim(),
      description: form.description.trim(),
      date: isoDate,
      startTime: form.startTime.trim(),
      endTime: form.endTime.trim(),
      location: form.location.trim(),
      capacity: parseInt(form.capacity, 10) || 1,
      ticketTiers: tiers,
      category: form.category,
      status: form.status,
    };
    setSaving(true);
    try {
      if (form.id) {
        const { bdeId: _omit, ...rest } = payload;
        await api.updateEvent(form.id, rest);
      } else {
        await api.createEvent(payload);
      }
      setFormVisible(false);
      markDirty();
      await loadSection();
    } catch (e) {
      dialog.alert({
        title: 'Erreur',
        message: e instanceof Error ? e.message : "Enregistrement impossible",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = (ev: Event) => {
    dialog.confirm({
      title: 'Supprimer l\'événement',
      message: `« ${ev.title} » sera définitivement supprimé.`,
      confirmText: 'Supprimer',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.deleteEvent(ev.id);
          await loadSection();
        } catch (e) {
          dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Suppression impossible' });
        }
      },
    });
  };

  const openAttendees = (ev: Event) => {
    setSelectedEventId(ev.id);
    setQrInput('');
    loadAttendees(ev.id);
    setAttendeesVisible(true);
  };

  const closeAttendees = () => {
    setAttendeesVisible(false);
    setSelectedEventId(null);
    setAttendees([]);
    setQrInput('');
  };

  const loadAttendees = async (eventId: string) => {
    try {
      setAttendees(await api.getEventAttendees(eventId));
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Chargement impossible' });
    }
  };

  const handleValidateQr = async (code?: string) => {
    const qrCode = (code ?? qrInput).trim();
    if (!selectedEventId || !qrCode) return;
    try {
      const ticket = await api.validateTicket(selectedEventId, qrCode);
      setQrInput('');
      await loadAttendees(selectedEventId);
      dialog.alert({
        title: 'Présence validée',
        message: `Billet ${ticket.ticketNumber} — ${ticket.user.displayName}`,
      });
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Validation impossible' });
    }
  };

  // ─── Membres / Utilisateurs ──────────────────────────────
  const toggleMemberAdmin = async (m: BdeMember) => {
    try {
      await api.setMemberAdmin(selectedBdeId, m.userId, !m.isAdmin);
      await loadSection();
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Action impossible' });
    }
  };

  const removeMember = (m: BdeMember) => {
    dialog.confirm({
      title: 'Retirer le membre',
      message: `${m.user.displayName} sera retiré du BDE.`,
      confirmText: 'Retirer',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.removeMember(selectedBdeId, m.userId);
          await loadSection();
        } catch (e) {
          dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Action impossible' });
        }
      },
    });
  };

  const changeUserRole = (u: AdminUser) => {
    if (u.id === user?.id) return;
    dialog.choose({
      title: 'Changer le rôle',
      message: `${u.displayName} — rôle actuel : ${ROLE_LABELS[u.role.toUpperCase()]}`,
      choices: (['STUDENT', 'ADMIN_BDE', 'SUPER_ADMIN'] as const).map((r) => ({
        text: ROLE_LABELS[r],
        onPress: async () => {
          try {
            await api.setUserRole(u.id, r);
            markDirty();
            await loadSection();
          } catch (e) {
            dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Action impossible' });
          }
        },
      })),
    });
  };

  const assignUserToBde = (u: AdminUser) => {
    if (managedBdes.length === 0) {
      dialog.alert({ title: 'Aucun BDE', message: 'Aucun BDE disponible à assigner.' });
      return;
    }
    dialog.choose({
      title: 'Assigner à un BDE',
      message: `Choisissez le BDE auquel rattacher ${u.displayName}.`,
      choices: managedBdes.map((b) => ({
        text: b.name,
        onPress: async () => {
          try {
            await api.assignUserToBde(b.id, u.id);
            markDirty();
            await loadSection();
          } catch (e) {
            dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Assignation impossible' });
          }
        },
      })),
    });
  };

  // ─── Code d'invitation ─────────────────────────────────────
  const shareJoinCode = async () => {
    if (!selectedBde?.joinCode) return;
    const message = `Rejoins ${selectedBde.name} sur MyBDE ! Code d'invitation à 6 chiffres : ${selectedBde.joinCode}`;
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title: 'MyBDE', text: message });
        } else if (nav?.clipboard) {
          await nav.clipboard.writeText(message);
          dialog.alert({ title: 'Copié', message: "Le message d'invitation a été copié." });
        } else {
          dialog.alert({ title: "Code d'invitation", message });
        }
        return;
      }
      await Share.share({ title: 'MyBDE', message });
    } catch {
      dialog.alert({ title: 'Erreur', message: 'Impossible de partager le code.' });
    }
  };

  const regenerateJoinCode = () => {
    if (!selectedBde) return;
    dialog.confirm({
      title: 'Régénérer le code',
      message: "L'ancien code d'invitation ne fonctionnera plus. Continuer ?",
      confirmText: 'Régénérer',
      onConfirm: async () => {
        try {
          const res = await api.regenerateBdeJoinCode(selectedBde.id);
          setManagedBdes((prev) =>
            prev.map((b) => (b.id === selectedBde.id ? { ...b, joinCode: res.joinCode } : b)),
          );
          markDirty();
        } catch (e) {
          dialog.alert({
            title: 'Erreur',
            message: e instanceof Error ? e.message : 'Régénération impossible',
          });
        }
      },
    });
  };

  // ─── Trésorerie ──────────────────────────────────────────
  const withdraw = () => {
    if (!selectedBde) return;
    const balance = selectedBde.balance ?? 0;
    const tiers = [20, 40, 60, 100].filter((t) => t <= balance);
    if (tiers.length === 0) {
      dialog.alert({
        title: 'Solde insuffisant',
        message: 'Le solde du BDE doit atteindre au moins 20 € pour un retrait.',
      });
      return;
    }
    dialog.choose({
      title: 'Retirer la trésorerie',
      message: `Solde : ${balance.toFixed(2)} €. Commission MyBDE de 5 % prélevée.`,
      choices: tiers.map((amount) => ({
        text: `${amount} € (net ${(amount * 0.95).toFixed(2)} €)`,
        onPress: () => doWithdraw(amount),
      })),
    });
  };

  const doWithdraw = async (amount: number) => {
    if (!selectedBde) return;
    try {
      const res = await api.withdrawBdeBalance(selectedBde.id, amount);
      setManagedBdes((prev) =>
        prev.map((b) => (b.id === selectedBde.id ? { ...b, balance: res.balance } : b)),
      );
      dialog.alert({
        title: 'Retrait effectué',
        message: `Net versé : ${res.netAmount.toFixed(2)} € (commission ${res.fee.toFixed(2)} €). Nouveau solde : ${res.balance.toFixed(2)} €.`,
      });
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Retrait impossible' });
    }
  };

  // ─── Contenu (actus) ─────────────────────────────────────
  const openCreateNews = () => {
    setEditingNewsId(null);
    setNewsContent('');
    setNewsVisible(true);
  };

  const openEditNews = (post: NewsPost) => {
    setEditingNewsId(post.id);
    setNewsContent(post.content);
    setNewsVisible(true);
  };

  const submitNews = async () => {
    if (!newsContent.trim()) {
      dialog.alert({ title: 'Contenu vide', message: 'Écrivez le contenu de l\'actualité.' });
      return;
    }
    try {
      if (editingNewsId) {
        await api.updateNews(editingNewsId, { content: newsContent.trim() });
      } else {
        if (!selectedBdeId) {
          dialog.alert({ title: 'BDE requis', message: 'Sélectionnez un BDE.' });
          return;
        }
        await api.createNews({ bdeId: selectedBdeId, content: newsContent.trim() });
      }
      setNewsContent('');
      setEditingNewsId(null);
      setNewsVisible(false);
      markDirty();
      await loadSection();
      dialog.alert({ title: editingNewsId ? 'Modifié' : 'Publié', message: 'L\'actualité a été enregistrée.' });
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Publication impossible' });
    }
  };

  const deleteNews = (post: NewsPost) => {
    dialog.confirm({
      title: 'Supprimer l\'actualité',
      message: 'Cette action est définitive.',
      confirmText: 'Supprimer',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.deleteNews(post.id);
          await loadSection();
        } catch (e) {
          dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Suppression impossible' });
        }
      },
    });
  };

  // Garde d'accès : seuls les rôles admin peuvent atteindre cet écran (ex. URL directe sur web).
  if (user && !isManager) {
    return <Redirect href="/(tabs)" />;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Gestion" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Gestion</Text>
        <Text style={styles.subtitle}>
          {isSuperAdmin ? 'Administration globale' : 'Espace administrateur BDE'}
        </Text>

        {/* Compteurs globaux (super admin) */}
        {isSuperAdmin && summary && (
          <View style={styles.statsRow}>
            <StatCard label="Utilisateurs" value={summary.usersCount} />
            <StatCard label="BDE" value={summary.bdesCount} />
            <StatCard label="Événements" value={summary.eventsCount} />
            <StatCard label="Actus" value={summary.newsCount} />
          </View>
        )}

        {/* Sélecteur de BDE (si plusieurs gérés) */}
        {managedBdes.length > 1 && section !== 'events' && section !== 'users' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bdeRow}>
            {managedBdes.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => setSelectedBdeId(b.id)}
                style={[styles.bdeChip, selectedBdeId === b.id && styles.bdeChipActive]}
              >
                <Text style={[styles.bdeChipText, selectedBdeId === b.id && styles.bdeChipTextActive]}>
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Onglets de section */}
        <View style={styles.tabs}>
          {sections.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSection(s)}
              style={[styles.tab, section === s && styles.tabActive]}
            >
              <Text style={[styles.tabText, section === s && styles.tabTextActive]}>
                {sectionLabel(s)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Recherche (événements / utilisateurs / actus) */}
        {(section === 'events' || section === 'users' || section === 'content') && (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={AppColors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                section === 'events' ? 'Rechercher un événement…'
                  : section === 'users' ? 'Rechercher un utilisateur…'
                  : 'Rechercher une actualité…'
              }
              placeholderTextColor={AppColors.textLight}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={AppColors.textLight} />
              </Pressable>
            )}
          </View>
        )}

        {/* Filtres catégorie / statut (événements) */}
        {section === 'events' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <Pressable onPress={() => setStatusFilter('')} style={[styles.filterChip, !statusFilter && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>Tous statuts</Text>
            </Pressable>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setStatusFilter(s)} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                  {s === 'DRAFT' ? 'Brouillon' : 'Publié'}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setCategoryFilter('')} style={[styles.filterChip, !categoryFilter && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, !categoryFilter && styles.filterChipTextActive]}>Toutes catégories</Text>
            </Pressable>
            {CATEGORIES.map((c) => (
              <Pressable key={c.value} onPress={() => setCategoryFilter(c.value)} style={[styles.filterChip, categoryFilter === c.value && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, categoryFilter === c.value && styles.filterChipTextActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Filtre rôle (utilisateurs) */}
        {section === 'users' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <Pressable onPress={() => setRoleFilter('')} style={[styles.filterChip, !roleFilter && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, !roleFilter && styles.filterChipTextActive]}>Tous rôles</Text>
            </Pressable>
            {ROLES.map((r) => (
              <Pressable key={r} onPress={() => setRoleFilter(r)} style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>{ROLE_LABELS[r]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ─── ÉVÉNEMENTS ─── */}
        {section === 'events' && (
          <>
            <Button title="Créer un événement" onPress={openCreate} icon={<Ionicons name="add" size={18} color={AppColors.white} />} style={styles.cta} />
            {events.length === 0 ? (
              <Empty label="Aucun événement" />
            ) : (
              <>
                {upcomingEvents.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>ÉVÉNEMENTS À VENIR</Text>
                    {upcomingEvents.map((ev) => (
                      <Card key={ev.id} variant="outlined" style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{ev.title}</Text>
                            <Text style={styles.itemMeta}>
                              {ev.bdeName} · {ev.date ? ev.date.slice(0, 10) : '—'} · {ev.currentAttendees}/{ev.capacity}
                            </Text>
                          </View>
                          <Badge
                            label={ev.status === 'published' ? 'Publié' : ev.status === 'draft' ? 'Brouillon' : ev.status}
                            variant={ev.status === 'published' ? 'success' : 'neutral'}
                          />
                        </View>
                        <View style={styles.itemActions}>
                          <Button title="Modifier" variant="outline" size="sm" onPress={() => openEdit(ev)} />
                          <Button title="Participants" variant="outline" size="sm" onPress={() => openAttendees(ev)} />
                          <Button title="Supprimer" variant="danger" size="sm" onPress={() => deleteEvent(ev)} />
                        </View>
                      </Card>
                    ))}
                  </>
                )}

                {pastEvents.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>ÉVÉNEMENTS PASSÉS</Text>
                    {pastEvents.map((ev) => (
                      <Card key={ev.id} variant="outlined" style={[styles.itemCard, { opacity: 0.7 }]}>
                        <View style={styles.itemHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{ev.title}</Text>
                            <Text style={styles.itemMeta}>
                              {ev.bdeName} · {ev.date ? ev.date.slice(0, 10) : '—'} · {ev.currentAttendees}/{ev.capacity}
                            </Text>
                          </View>
                          <Badge label="Archivé" variant="neutral" />
                        </View>
                        <View style={styles.itemActions}>
                          <Button title="Participants" variant="outline" size="sm" onPress={() => openAttendees(ev)} />
                          <Button title="Supprimer" variant="danger" size="sm" onPress={() => deleteEvent(ev)} />
                        </View>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ─── MEMBRES (admin BDE) ─── */}
        {section === 'members' && (
          <>
            {selectedBde?.joinCode && (
              <Card style={styles.joinCodeCard}>
                <Text style={styles.treasuryLabel}>Code d&apos;invitation</Text>
                <Text style={styles.joinCodeValue}>{selectedBde.joinCode}</Text>
                <Text style={styles.treasuryHint}>
                  Partagez ce code à 6 chiffres pour laisser un étudiant rejoindre {selectedBde.name}.
                </Text>
                <View style={styles.joinCodeActions}>
                  <Button title="Partager" size="sm" onPress={shareJoinCode} style={{ flex: 1 }} />
                  <Button title="Régénérer" variant="outline" size="sm" onPress={regenerateJoinCode} style={{ flex: 1 }} />
                </View>
              </Card>
            )}
            {members.length === 0 ? (
              <Empty label="Aucun membre" />
            ) : (
              members.map((m) => (
                <Card key={m.id} variant="outlined" style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Avatar name={m.user.displayName} uri={m.user.profilePicture} size={40} />
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={styles.itemTitle}>{m.user.displayName}</Text>
                      <Text style={styles.itemMeta}>{m.isAdmin ? 'Administrateur' : 'Membre'}</Text>
                    </View>
                    {m.isAdmin && <Badge label="Admin" variant="primary" />}
                  </View>
                  <View style={styles.itemActions}>
                    <Button
                      title={m.isAdmin ? 'Retirer admin' : 'Promouvoir admin'}
                      variant="outline"
                      size="sm"
                      onPress={() => toggleMemberAdmin(m)}
                    />
                    <Button title="Retirer" variant="danger" size="sm" onPress={() => removeMember(m)} />
                  </View>
                </Card>
              ))
            )}
          </>
        )}

        {/* ─── UTILISATEURS (super admin) ─── */}
        {section === 'users' && (
          users.length === 0 ? (
            <Empty label="Aucun utilisateur" />
          ) : (
            users.map((u) => (
              <Card key={u.id} variant="outlined" style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Avatar name={u.displayName} uri={u.profilePicture} size={40} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.itemTitle}>{u.displayName}</Text>
                    <Text style={styles.itemMeta}>{u.email}</Text>
                    <Text style={styles.itemMeta}>
                      {u.bdeMembers && u.bdeMembers.length > 0
                        ? u.bdeMembers.map((m) => m.bde.name).join(', ')
                        : 'Aucun BDE'}
                    </Text>
                  </View>
                  <Badge
                    label={ROLE_LABELS[u.role.toUpperCase()] ?? u.role}
                    variant={u.role === 'super_admin' ? 'primary' : u.role === 'admin_bde' ? 'info' : 'neutral'}
                  />
                </View>
                <View style={styles.itemActions}>
                  {u.id !== user?.id && (
                    <Button title="Changer le rôle" variant="outline" size="sm" onPress={() => changeUserRole(u)} />
                  )}
                  <Button title="Assigner à un BDE" variant="outline" size="sm" onPress={() => assignUserToBde(u)} />
                </View>
              </Card>
            ))
          )
        )}

        {/* ─── TRÉSORERIE ─── */}
        {section === 'treasury' && (
          selectedBde ? (
            <Card style={styles.treasuryCard}>
              <Text style={styles.treasuryLabel}>Solde de {selectedBde.name}</Text>
              <Text style={styles.treasuryAmount}>{(selectedBde.balance ?? 0).toFixed(2)} €</Text>
              <Text style={styles.treasuryHint}>
                Issu des ventes de billets. Retraits par paliers de 20 €, commission MyBDE de 5 %.
              </Text>
              <Button title="Retirer des fonds" onPress={withdraw} style={{ marginTop: Spacing.base }} fullWidth />
            </Card>
          ) : (
            <Empty label="Aucun BDE à gérer" />
          )
        )}

        {/* ─── CONTENU (actus) ─── */}
        {section === 'content' && (
          <>
            <Button
              title="Publier une actualité"
              onPress={openCreateNews}
              icon={<Ionicons name="megaphone-outline" size={18} color={AppColors.white} />}
              style={styles.cta}
            />
            {news.length === 0 ? (
              <Empty label="Aucune actualité" />
            ) : (
              news.map((post) => (
                <Card key={post.id} variant="outlined" style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{post.bdeName}</Text>
                      <Text style={styles.itemMeta}>
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString('fr-FR') : '—'} · {post.likes} like{post.likes > 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.newsContent} numberOfLines={3}>
                        {post.content}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <Button title="Modifier" variant="outline" size="sm" onPress={() => openEditNews(post)} />
                    <Button title="Supprimer" variant="danger" size="sm" onPress={() => deleteNews(post)} />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Modale formulaire événement */}
      <EventFormModal
        visible={formVisible}
        form={form}
        setForm={setForm}
        saving={saving}
        managedBdes={managedBdes}
        onClose={() => setFormVisible(false)}
        onSubmit={submitForm}
      />

      {/* Modale actualité */}
      <NewsModal
        visible={newsVisible}
        content={newsContent}
        setContent={setNewsContent}
        editingId={editingNewsId}
        onClose={() => setNewsVisible(false)}
        onSubmit={submitNews}
      />

      {/* Modale participants / validation QR */}
      <AttendeesModal
        visible={attendeesVisible}
        attendees={attendees}
        qrInput={qrInput}
        setQrInput={setQrInput}
        onClose={closeAttendees}
        onValidate={handleValidateQr}
        dialog={dialog}
      />
    </SafeAreaView>
  );
}

function sectionLabel(s: Section): string {
  switch (s) {
    case 'events': return 'Événements';
    case 'members': return 'Membres';
    case 'users': return 'Utilisateurs';
    case 'treasury': return 'Trésorerie';
    case 'content': return 'Contenu';
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="file-tray-outline" size={32} color={AppColors.textLight} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType }: FieldProps) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.field, multiline && styles.fieldMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={AppColors.textLight}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

interface EventFormModalProps {
  visible: boolean;
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  saving: boolean;
  managedBdes: BDE[];
  onClose: () => void;
  onSubmit: () => void;
}

function EventFormModal({ visible, form, setForm, saving, managedBdes, onClose, onSubmit }: EventFormModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(720, Math.round(height * 0.9)) : height;
  const cardWidth = isDesktop ? Math.min(600, Math.round(width * 0.9)) : width;

  return (
    <Modal visible={visible} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { height: cardHeight, width: cardWidth }, isDesktop && styles.modalCardDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{form.id ? 'Modifier l\'événement' : 'Nouvel événement'}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.sm }} keyboardShouldPersistTaps="handled">
            {managedBdes.length > 1 && !form.id && (
              <>
                <Text style={styles.fieldLabel}>BDE organisateur</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  {managedBdes.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => setForm((f) => ({ ...f, bdeId: b.id }))}
                      style={[styles.chip, form.bdeId === b.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, form.bdeId === b.id && styles.chipTextActive]}>{b.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
            <Field label="Titre" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
            <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
            <Field label="Date (AAAA-MM-JJ)" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} placeholder="2026-12-15" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Début" value={form.startTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} placeholder="20:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Fin" value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} placeholder="23:00" />
              </View>
            </View>
            <Field label="Lieu" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
            <Field label="Capacité" value={form.capacity} onChange={(v) => setForm((f) => ({ ...f, capacity: v }))} keyboardType="numeric" />

            <Text style={styles.fieldLabel}>Tarifs</Text>
            {form.tiers.map((tier, i) => (
              <View key={i} style={[styles.row, { alignItems: 'center', marginBottom: Spacing.sm }]}>
                <View style={{ flex: 2 }}>
                  <TextInput
                    style={styles.field}
                    value={tier.name}
                    placeholder="Nom du tarif (ex. Standard, VIP)"
                    placeholderTextColor={AppColors.textLight}
                    onChangeText={(v) =>
                      setForm((f) => ({
                        ...f,
                        tiers: f.tiers.map((t, ti) => (ti === i ? { ...t, name: v } : t)),
                      }))
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.field}
                    value={tier.price}
                    placeholder="Prix (€)"
                    placeholderTextColor={AppColors.textLight}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      setForm((f) => ({
                        ...f,
                        tiers: f.tiers.map((t, ti) => (ti === i ? { ...t, price: v } : t)),
                      }))
                    }
                  />
                </View>
                {form.tiers.length > 1 && (
                  <Pressable
                    onPress={() => setForm((f) => ({ ...f, tiers: f.tiers.filter((_, ti) => ti !== i) }))}
                    style={{ padding: Spacing.sm }}
                  >
                    <Ionicons name="trash-outline" size={20} color={AppColors.danger} />
                  </Pressable>
                )}
              </View>
            ))}
            <Button
              title="+ Ajouter un tarif"
              variant="outline"
              size="sm"
              onPress={() => setForm((f) => ({ ...f, tiers: [...f.tiers, { name: '', price: '0' }] }))}
              style={{ marginBottom: Spacing.md, alignSelf: 'flex-start' }}
            />

            <Text style={styles.fieldLabel}>Catégorie</Text>
            <View style={styles.chipsWrap}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.value} onPress={() => setForm((f) => ({ ...f, category: c.value }))} style={[styles.chip, form.category === c.value && styles.chipActive]}>
                  <Text style={[styles.chipText, form.category === c.value && styles.chipTextActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Statut</Text>
            <View style={styles.chipsWrap}>
              {STATUSES.map((s) => (
                <Pressable key={s} onPress={() => setForm((f) => ({ ...f, status: s }))} style={[styles.chip, form.status === s && styles.chipActive]}>
                  <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s === 'DRAFT' ? 'Brouillon' : 'Publié'}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button
              title={form.id ? 'Enregistrer' : 'Créer'}
              onPress={onSubmit}
              loading={saving}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface NewsModalProps {
  visible: boolean;
  content: string;
  setContent: (v: string) => void;
  editingId: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

function NewsModal({ visible, content, setContent, editingId, onClose, onSubmit }: NewsModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(420, Math.round(height * 0.6)) : height;
  const cardWidth = isDesktop ? Math.min(560, Math.round(width * 0.9)) : width;
  const isEditing = !!editingId;

  return (
    <Modal visible={visible} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { height: cardHeight, width: cardWidth }, isDesktop && styles.modalCardDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEditing ? 'Modifier l\'actualité' : 'Nouvelle actualité'}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Contenu"
              value={content}
              onChange={setContent}
              multiline
              placeholder="Quoi de neuf au BDE ?"
            />
          </View>
          <View style={styles.modalFooter}>
            <Button title={isEditing ? 'Enregistrer' : 'Publier'} onPress={onSubmit} fullWidth size="lg" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Attendee {
  id: string;
  ticketNumber: string;
  qrCode: string;
  status: string;
  ticketType: string;
  seatInfo?: string | null;
  purchasedAt: string;
  user: { id: string; displayName: string; email: string; profilePicture?: string | null };
}

interface AttendeesModalProps {
  visible: boolean;
  attendees: Attendee[];
  qrInput: string;
  setQrInput: (v: string) => void;
  onClose: () => void;
  onValidate: (code?: string) => void;
  dialog: ReturnType<typeof useDialog>;
}

function AttendeesModal({ visible, attendees, qrInput, setQrInput, onClose, onValidate, dialog }: AttendeesModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(720, Math.round(height * 0.9)) : height;
  const cardWidth = isDesktop ? Math.min(640, Math.round(width * 0.9)) : width;
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!visible) setScanning(false);
  }, [visible]);
  const validCount = attendees.filter((a) => ['valid', 'used'].includes(a.status.toLowerCase())).length;
  const usedCount = attendees.filter((a) => a.status.toLowerCase() === 'used').length;

  const handleScanPress = async () => {
    if (isWeb) {
      dialog.alert({ title: 'Scanner indisponible', message: 'La caméra n\'est pas disponible sur le web. Saisissez le code manuellement.' });
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        dialog.alert({ title: 'Permission requise', message: 'Autorisez l\'accès à la caméra pour scanner les QR codes.' });
        return;
      }
    }
    setScanning(true);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (!data || scanning === false) return;
    setScanning(false);
    setQrInput(data);
    onValidate(data);
  };

  return (
    <Modal visible={visible} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { height: cardHeight, width: cardWidth }, isDesktop && styles.modalCardDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Participants</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.attendeesStats}>
              {attendees.length} inscrit{attendees.length > 1 ? 's' : ''} · {usedCount}/{validCount} présence{validCount > 1 ? 's' : ''} validée{validCount > 1 ? 's' : ''}
            </Text>

            <View style={styles.qrInputRow}>
              <TextInput
                style={styles.qrInput}
                placeholder="Saisir le code QR du billet..."
                placeholderTextColor={AppColors.textLight}
                value={qrInput}
                onChangeText={setQrInput}
                onSubmitEditing={() => onValidate()}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button title="" icon={<Ionicons name="barcode-outline" size={24} color={AppColors.white} />} onPress={handleScanPress} size="md" />
              <Button title="Valider" onPress={() => onValidate()} size="md" />
            </View>

            {scanning && (
              <View style={styles.cameraWrap}>
                <CameraView
                  style={styles.camera}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcode}
                >
                  <View style={styles.cameraOverlay}>
                    <View style={styles.cameraTarget} />
                  </View>
                </CameraView>
                <Button title="Annuler le scan" onPress={() => setScanning(false)} size="sm" variant="outline" fullWidth style={{ marginTop: Spacing.sm }} />
              </View>
            )}

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {attendees.length === 0 ? (
                <Text style={styles.emptyText}>Aucun participant inscrit</Text>
              ) : (
                attendees.map((a) => (
                  <Card key={a.id} variant="outlined" style={styles.attendeeCard}>
                    <View style={styles.itemHeader}>
                      <Avatar name={a.user.displayName} uri={a.user.profilePicture} size={40} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <Text style={styles.itemTitle}>{a.user.displayName}</Text>
                        <Text style={styles.itemMeta}>{a.user.email} · N° {a.ticketNumber}</Text>
                      </View>
                      <Badge
                        label={a.status.toLowerCase() === 'used' ? 'Présent' : a.status.toLowerCase() === 'valid' ? 'Inscrit' : a.status}
                        variant={a.status.toLowerCase() === 'used' ? 'success' : a.status.toLowerCase() === 'valid' ? 'info' : 'neutral'}
                        size="sm"
                      />
                    </View>
                  </Card>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.surface },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontFamily: FontFamily.display, fontSize: FontSizes.xxl, color: AppColors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginBottom: Spacing.base },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: { flexGrow: 1, minWidth: 120, backgroundColor: AppColors.white, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.border, paddingVertical: Spacing.md, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.display, fontSize: FontSizes.xl, color: AppColors.primary },
  statLabel: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textSecondary, marginTop: 2 },
  filterRow: { marginBottom: Spacing.base },
  filterChip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: AppColors.white, borderWidth: 1, borderColor: AppColors.border, marginRight: Spacing.sm },
  filterChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  filterChipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.xs, color: AppColors.textSecondary },
  filterChipTextActive: { color: AppColors.white },
  bdeRow: { marginBottom: Spacing.sm },
  bdeChip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: AppColors.white, borderWidth: 1, borderColor: AppColors.border, marginRight: Spacing.sm },
  bdeChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  bdeChipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  bdeChipTextActive: { color: AppColors.white },
  tabs: { flexDirection: 'row', backgroundColor: AppColors.white, borderRadius: BorderRadius.md, padding: 4, marginBottom: Spacing.base },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: AppColors.primaryLight },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  tabTextActive: { color: AppColors.primary, fontFamily: FontFamily.bodySemibold },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: AppColors.white, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, height: 44, marginBottom: Spacing.base, borderWidth: 1, borderColor: AppColors.border },
  searchInput: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.text },
  cta: { marginBottom: Spacing.base },
  itemCard: { marginBottom: Spacing.md },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemTitle: { fontFamily: FontFamily.displaySemibold, fontSize: FontSizes.base, color: AppColors.text },
  itemMeta: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginTop: 2 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  treasuryCard: { alignItems: 'flex-start' },
  treasuryLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  treasuryAmount: { fontFamily: FontFamily.display, fontSize: FontSizes.xxxl, color: AppColors.primary, marginVertical: Spacing.xs },
  treasuryHint: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  joinCodeCard: { alignItems: 'flex-start', marginBottom: Spacing.base },
  joinCodeValue: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xxxl,
    color: AppColors.primary,
    letterSpacing: 4,
    marginVertical: Spacing.xs,
  },
  joinCodeActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base, width: '100%' },
  contentHint: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  newsContent: { fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.text, marginTop: Spacing.sm, lineHeight: 22 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.textLight },
  modalOverlay: { backgroundColor: AppColors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: AppColors.white, padding: Spacing.lg },
  modalCardDesktop: { borderRadius: BorderRadius.xl },
  modalOverlayDesktop: { justifyContent: 'center', alignItems: 'center' },
  modalFooter: { paddingTop: Spacing.base, borderTopWidth: 1, borderTopColor: AppColors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.base },
  modalTitle: { fontFamily: FontFamily.display, fontSize: FontSizes.lg, color: AppColors.text },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginBottom: Spacing.xs },
  field: { backgroundColor: AppColors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.text, borderWidth: 1, borderColor: AppColors.border },
  fieldMultiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.md },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.border, marginRight: Spacing.sm },
  chipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.xs, color: AppColors.textSecondary },
  chipTextActive: { color: AppColors.white },
  sectionLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.xs, color: AppColors.textLight, letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  attendeesStats: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginBottom: Spacing.base },
  qrInputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  qrInput: { flex: 1, backgroundColor: AppColors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.text, borderWidth: 1, borderColor: AppColors.border },
  attendeeCard: { marginBottom: Spacing.sm },
  attendeeQr: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textLight, marginTop: Spacing.sm },
  cameraWrap: { marginBottom: Spacing.base, overflow: 'hidden', borderRadius: BorderRadius.md },
  camera: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.md },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  cameraTarget: { width: 200, height: 200, borderWidth: 2, borderColor: AppColors.white, borderRadius: BorderRadius.lg, backgroundColor: 'transparent' },
});
