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
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { AttendeesManager } from '@/components/AttendeesManager';
import { AppColors, BorderRadius, FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { EVENT_CATEGORIES } from '@/constants/eventCategories';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useTransition } from '@/context/TransitionContext';
import { api, type EventInput } from '@/services/api';
import type { BDE, Event, BdeMember, AdminUser, NewsPost, AdminSummary } from '@/types';

type Section = 'events' | 'members' | 'users' | 'treasury' | 'content' | 'infos';

const CATEGORIES = EVENT_CATEGORIES.map((c) => ({ value: c.value.toUpperCase(), label: c.label }));
const STATUSES = ['DRAFT', 'PUBLISHED'] as const;
const PAGE_SIZE = 15;
const USERS_PAGE_SIZE = 10;
const UPCOMING_PREVIEW = 5;
// Sous-onglets d'un BDE (vue « détail BDE »). L'administration globale des
// comptes reste un onglet de 1er niveau distinct (super admin).
const BDE_SUBTABS: Section[] = ['infos', 'events', 'members', 'content', 'treasury'];
const BDE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
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

  // Sous-onglet actif dans la vue détail d'un BDE (ou 'users' pour l'admin
  // global des comptes). Un admin BDE arrive directement sur les événements.
  const [section, setSection] = useState<Section>('events');
  // Super admin : navigation de 1er niveau — navigateur de BDE vs. comptes.
  const [topNav, setTopNav] = useState<'bde' | 'users'>('bde');
  const [bdeQuery, setBdeQuery] = useState('');
  const [managedBde, setManagedBde] = useState<BDE | null>(null);
  const [createBdeVisible, setCreateBdeVisible] = useState(false);
  const [managedBdes, setManagedBdes] = useState<BDE[]>([]);
  const [selectedBdeId, setSelectedBdeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [members, setMembers] = useState<BdeMember[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Événements en gestion : « voir plus » sur les à venir, accordéon replié sur les passés.
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  // Administration d'un utilisateur (super admin).
  const [managedUser, setManagedUser] = useState<AdminUser | null>(null);
  const [allBdes, setAllBdes] = useState<BDE[]>([]);
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
  const [newsImage, setNewsImage] = useState('');
  const [news, setNews] = useState<NewsPost[]>([]);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);

  const [attendeesVisible, setAttendeesVisible] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
        // Un admin BDE n'a qu'un seul BDE : on le sélectionne d'emblée pour
        // arriver directement sur ses sous-onglets. Le super admin, lui, passe
        // par le navigateur de BDE (aucune sélection par défaut).
        if (!isSuperAdmin && bdes.length > 0) {
          setSelectedBdeId((prev) => prev || bdes[0].id);
        }
      })
      .catch((e) => console.error('Erreur BDE gérés:', e))
      .finally(() => setLoading(false));
  }, []);

  const loadSection = useCallback(async () => {
    try {
      if (section === 'events') {
        const res = await api.getAdminEvents({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          bdeId: selectedBdeId || undefined,
          page: 1,
          limit: PAGE_SIZE,
        });
        setEvents(res.events);
        setEventsTotal(res.total);
      } else if (section === 'users') {
        const res = await api.getUsers({
          search: search.trim() || undefined,
          role: roleFilter || undefined,
          page: 1,
          limit: USERS_PAGE_SIZE,
        });
        setUsers(res.users);
        setUsersTotal(res.total);
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

  // Chargement à la demande (pagination) pour les listes potentiellement longues.
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (section === 'events') {
        const page = Math.floor(events.length / PAGE_SIZE) + 1;
        const res = await api.getAdminEvents({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          bdeId: selectedBdeId || undefined,
          page,
          limit: PAGE_SIZE,
        });
        setEvents((prev) => [...prev, ...res.events]);
        setEventsTotal(res.total);
      } else if (section === 'users') {
        const page = Math.floor(users.length / USERS_PAGE_SIZE) + 1;
        const res = await api.getUsers({
          search: search.trim() || undefined,
          role: roleFilter || undefined,
          page,
          limit: USERS_PAGE_SIZE,
        });
        setUsers((prev) => [...prev, ...res.users]);
        setUsersTotal(res.total);
      }
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Chargement impossible' });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.getAdminSummary().then(setSummary).catch((e) => console.error('Erreur compteurs admin:', e));
    api.getBdes().then(setAllBdes).catch((e) => console.error('Erreur liste BDE:', e));
  }, [isSuperAdmin]);

  /** Recharge l'utilisateur en cours d'administration + la liste. */
  const refreshManagedUser = async () => {
    if (!managedUser) return;
    try {
      const fresh = await api.getUser(managedUser.id);
      setManagedUser(fresh);
    } catch (e) {
      console.error('Erreur rafraîchissement utilisateur:', e);
    }
    await loadSection();
  };

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
    setAttendeesVisible(true);
  };

  const closeAttendees = () => {
    setAttendeesVisible(false);
    setSelectedEventId(null);
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

  // Lien d'invitation : ouvre la page d'inscription avec le code pré-rempli.
  // - Web : URL classique basée sur l'origine du site.
  // - Natif : véritable deep link (scheme `mybdereactnative://`) qui ouvre
  //   l'application directement sur l'inscription — Linking.createURL gère le
  //   scheme correct (dev, standalone) au lieu d'un domaine mort.
  const buildJoinLink = (code: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}/signup?code=${code}`;
    }
    return Linking.createURL('/signup', { queryParams: { code } });
  };

  const shareJoinLink = async () => {
    if (!selectedBde?.joinCode) return;
    const link = buildJoinLink(selectedBde.joinCode);
    const message = `Rejoins ${selectedBde.name} sur MyBDE : ${link}`;
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title: 'MyBDE', text: message, url: link });
        } else if (nav?.clipboard) {
          await nav.clipboard.writeText(link);
          dialog.alert({ title: 'Lien copié', message: "Le lien d'invitation a été copié." });
        } else {
          dialog.alert({ title: "Lien d'invitation", message: link });
        }
        return;
      }
      await Share.share({ title: 'MyBDE', message });
    } catch {
      dialog.alert({ title: 'Erreur', message: "Impossible de partager le lien." });
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
    setNewsImage('');
    setNewsVisible(true);
  };

  const openEditNews = (post: NewsPost) => {
    setEditingNewsId(post.id);
    setNewsContent(post.content);
    setNewsImage(post.image ?? '');
    setNewsVisible(true);
  };

  const submitNews = async () => {
    if (!newsContent.trim()) {
      dialog.alert({ title: 'Contenu vide', message: 'Écrivez le contenu de l\'actualité.' });
      return;
    }
    const image = newsImage.trim() || undefined;
    try {
      if (editingNewsId) {
        await api.updateNews(editingNewsId, { content: newsContent.trim(), image });
      } else {
        if (!selectedBdeId) {
          dialog.alert({ title: 'BDE requis', message: 'Sélectionnez un BDE.' });
          return;
        }
        await api.createNews({ bdeId: selectedBdeId, content: newsContent.trim(), image });
      }
      setNewsContent('');
      setNewsImage('');
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

  // ─── Navigation BDE-centrée ──────────────────────────────
  // Super admin : navigateur de BDE (liste + recherche) → détail d'un BDE
  // (sous-onglets), ou administration globale des comptes. Admin BDE : détail
  // direct de son unique BDE.
  const showGlobalUsers = isSuperAdmin && topNav === 'users';
  const showBrowser = isSuperAdmin && topNav === 'bde' && !selectedBdeId;
  const inBdeDetail = !isSuperAdmin || (topNav === 'bde' && !!selectedBdeId);
  const bdeSearchTerm = bdeQuery.trim().toLowerCase();
  const filteredBdes = managedBdes.filter(
    (b) =>
      !bdeSearchTerm ||
      b.name.toLowerCase().includes(bdeSearchTerm) ||
      (b.university ?? '').toLowerCase().includes(bdeSearchTerm),
  );

  const openBde = (id: string) => {
    setSelectedBdeId(id);
    setSection('infos');
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
  };
  const backToBrowser = () => {
    setSelectedBdeId('');
    setBdeQuery('');
  };
  const goTopNav = (nav: 'bde' | 'users') => {
    setTopNav(nav);
    setSearch('');
    if (nav === 'users') setSection('users');
    else setSection(selectedBdeId ? 'infos' : 'events');
  };

  const openBdeEditor = () => {
    if (selectedBde) setManagedBde(selectedBde);
  };
  const onBdeUpdated = (updated: BDE) => {
    setManagedBdes((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
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

        {/* Navigation 1er niveau (super admin) : BDE vs. comptes globaux */}
        {isSuperAdmin && (
          <View style={styles.tabs}>
            <Pressable onPress={() => goTopNav('bde')} style={[styles.tab, topNav === 'bde' && styles.tabActive]}>
              <Text style={[styles.tabText, topNav === 'bde' && styles.tabTextActive]}>BDE</Text>
            </Pressable>
            <Pressable onPress={() => goTopNav('users')} style={[styles.tab, topNav === 'users' && styles.tabActive]}>
              <Text style={[styles.tabText, topNav === 'users' && styles.tabTextActive]}>Utilisateurs</Text>
            </Pressable>
          </View>
        )}

        {/* Navigateur de BDE (super admin) : dropdown/recherche pour cibler un BDE */}
        {showBrowser && (
          <>
            <Button
              title="Créer un BDE"
              size="sm"
              onPress={() => setCreateBdeVisible(true)}
              style={{ alignSelf: 'flex-start', marginBottom: Spacing.base }}
            />
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={AppColors.textLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un BDE (nom, université)…"
                placeholderTextColor={AppColors.textLight}
                value={bdeQuery}
                onChangeText={setBdeQuery}
              />
              {bdeQuery.length > 0 && (
                <Pressable onPress={() => setBdeQuery('')}>
                  <Ionicons name="close-circle" size={18} color={AppColors.textLight} />
                </Pressable>
              )}
            </View>
            {filteredBdes.length === 0 ? (
              <Empty label="Aucun BDE" />
            ) : (
              filteredBdes.map((b) => (
                <Card key={b.id} variant="outlined" style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{b.name}</Text>
                      <Text style={styles.itemMeta}>{b.university || '—'}</Text>
                      <Text style={styles.itemMeta}>
                        {b.memberCount} membre{b.memberCount > 1 ? 's' : ''} · {b.eventCount ?? 0} événement{(b.eventCount ?? 0) > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Badge
                      label={b.status === 'active' ? 'Actif' : b.status === 'suspended' ? 'Suspendu' : 'Inactif'}
                      variant={b.status === 'active' ? 'success' : 'neutral'}
                    />
                  </View>
                  <View style={styles.itemActions}>
                    <Button title="Gérer" variant="outline" size="sm" onPress={() => openBde(b.id)} />
                  </View>
                </Card>
              ))
            )}
          </>
        )}

        {/* En-tête détail BDE + sous-onglets */}
        {inBdeDetail && selectedBde && (
          <>
            <View style={styles.detailHeader}>
              {isSuperAdmin && (
                <Pressable onPress={backToBrowser} style={styles.backLink} hitSlop={8}>
                  <Ionicons name="chevron-back" size={18} color={AppColors.primary} />
                  <Text style={styles.backLinkText}>Tous les BDE</Text>
                </Pressable>
              )}
              <Text style={styles.detailBdeName}>{selectedBde.name}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bdeRow}>
              {BDE_SUBTABS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { setSection(s); setSearch(''); }}
                  style={[styles.bdeChip, section === s && styles.bdeChipActive]}
                >
                  <Text style={[styles.bdeChipText, section === s && styles.bdeChipTextActive]}>
                    {sectionLabel(s)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Recherche (événements / utilisateurs / actus) */}
        {!showBrowser && (section === 'events' || section === 'users' || section === 'content') && (
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

        {/* Filtres catégorie / statut (événements) — menus déroulants */}
        {inBdeDetail && section === 'events' && (
          <View style={styles.selectRow}>
            <SelectField
              label="Statut"
              value={statusFilter}
              onSelect={setStatusFilter}
              dialog={dialog}
              options={[
                { value: '', label: 'Tous statuts' },
                ...STATUSES.map((s) => ({ value: s, label: s === 'DRAFT' ? 'Brouillon' : 'Publié' })),
              ]}
            />
            <SelectField
              label="Catégorie"
              value={categoryFilter}
              onSelect={setCategoryFilter}
              dialog={dialog}
              options={[{ value: '', label: 'Toutes catégories' }, ...CATEGORIES]}
            />
          </View>
        )}

        {/* Filtre rôle (utilisateurs) — menu déroulant */}
        {showGlobalUsers && (
          <View style={styles.selectRow}>
            <SelectField
              label="Rôle"
              value={roleFilter}
              onSelect={setRoleFilter}
              dialog={dialog}
              options={[
                { value: '', label: 'Tous rôles' },
                ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
              ]}
            />
          </View>
        )}

        {/* ─── INFOS DU BDE ─── */}
        {inBdeDetail && section === 'infos' && selectedBde && (
          <>
            <Card variant="outlined" style={styles.itemCard}>
              <Text style={styles.itemTitle}>{selectedBde.name}</Text>
              <Text style={styles.itemMeta}>{selectedBde.university || 'Université non renseignée'}</Text>
              <Text style={[styles.itemMeta, { marginTop: Spacing.sm }]}>
                {selectedBde.description || 'Aucune description.'}
              </Text>
              <View style={[styles.itemHeader, { marginTop: Spacing.md }]}>
                <Badge
                  label={selectedBde.status === 'active' ? 'Actif' : selectedBde.status === 'suspended' ? 'Suspendu' : 'Inactif'}
                  variant={selectedBde.status === 'active' ? 'success' : 'neutral'}
                />
                <Text style={styles.itemMeta}>
                  {selectedBde.memberCount} membre{selectedBde.memberCount > 1 ? 's' : ''} · {selectedBde.eventCount ?? 0} événement{(selectedBde.eventCount ?? 0) > 1 ? 's' : ''}
                </Text>
              </View>
            </Card>
            <Button
              title="Modifier les informations"
              variant="outline"
              onPress={openBdeEditor}
              icon={<Ionicons name="create-outline" size={18} color={AppColors.primary} />}
              style={styles.cta}
            />
            {/* Le code d'invitation décrit le BDE (comment le rejoindre), il a
                donc sa place ici plutôt que dans la trésorerie. */}
            {selectedBde.joinCode && (
              <Card style={styles.joinCodeCard}>
                <Text style={styles.treasuryLabel}>Code d&apos;invitation</Text>
                <Text style={styles.joinCodeValue}>{selectedBde.joinCode}</Text>
                <Text style={styles.treasuryHint}>
                  Partagez ce code à 6 chiffres pour laisser un étudiant rejoindre {selectedBde.name}.
                </Text>
                <View style={styles.joinCodeActions}>
                  <Button title="Partager le code" size="sm" onPress={shareJoinCode} style={{ flex: 1 }} />
                  <Button title="Inviter par lien" variant="secondary" size="sm" onPress={shareJoinLink} style={{ flex: 1 }} />
                </View>
                <View style={[styles.joinCodeActions, { marginTop: Spacing.sm }]}>
                  <Button title="Régénérer le code" variant="outline" size="sm" onPress={regenerateJoinCode} style={{ flex: 1 }} />
                </View>
              </Card>
            )}
          </>
        )}

        {/* ─── ÉVÉNEMENTS ─── */}
        {inBdeDetail && section === 'events' && (
          <>
            <Button title="Créer un événement" onPress={openCreate} icon={<Ionicons name="add" size={18} color={AppColors.white} />} style={styles.cta} />
            {events.length === 0 ? (
              <Empty label="Aucun événement" />
            ) : (
              <>
                {upcomingEvents.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>ÉVÉNEMENTS À VENIR ({upcomingEvents.length})</Text>
                    {(showAllUpcoming ? upcomingEvents : upcomingEvents.slice(0, UPCOMING_PREVIEW)).map((ev) => (
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
                    {!showAllUpcoming && upcomingEvents.length > UPCOMING_PREVIEW && (
                      <Button
                        title={`Voir plus (${upcomingEvents.length - UPCOMING_PREVIEW})`}
                        variant="outline"
                        size="sm"
                        onPress={() => setShowAllUpcoming(true)}
                        style={{ marginBottom: Spacing.sm }}
                      />
                    )}
                  </>
                )}

                {pastEvents.length > 0 && (
                  <>
                    <Pressable
                      style={styles.accordionHeader}
                      onPress={() => setShowPastEvents((v) => !v)}
                    >
                      <Text style={styles.accordionTitle}>Événements passés ({pastEvents.length})</Text>
                      <Ionicons
                        name={showPastEvents ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={AppColors.textSecondary}
                      />
                    </Pressable>
                    {showPastEvents && pastEvents.map((ev) => (
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

        {inBdeDetail && section === 'events' && events.length < eventsTotal && (
          <Button
            title={`Charger plus (${events.length}/${eventsTotal})`}
            variant="outline"
            onPress={loadMore}
            loading={loadingMore}
            style={{ marginTop: Spacing.sm }}
          />
        )}

        {/* ─── UTILISATEURS DU BDE (membres) ─── */}
        {inBdeDetail && section === 'members' && (
          <>
            {members.length === 0 ? (
              <Empty label="Aucun membre" />
            ) : (
              members.map((m) => {
                const isSelf = m.userId === user?.id;
                const otherAdmins = members.filter((x) => x.isAdmin && x.userId !== user?.id).length;
                // On ne peut pas se retirer soi-même tant qu'on est le dernier admin.
                const canRemoveSelf = !isSelf || otherAdmins > 0;
                return (
                  <Card key={m.id} variant="outlined" style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Avatar name={m.user.displayName} uri={m.user.profilePicture} size={40} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <Text style={styles.itemTitle}>{m.user.displayName}{isSelf ? ' (vous)' : ''}</Text>
                        {m.user.email && <Text style={styles.itemMeta}>{m.user.email}</Text>}
                        <Text style={styles.itemMeta}>{m.isAdmin ? 'Administrateur' : 'Membre'}</Text>
                      </View>
                      {m.isAdmin && <Badge label="Admin" variant="primary" />}
                    </View>
                    <View style={styles.itemActions}>
                      {/* Un admin BDE ne peut pas modifier son propre rôle. */}
                      {!isSelf && (
                        <Button
                          title={m.isAdmin ? 'Retirer admin' : 'Promouvoir admin'}
                          variant="outline"
                          size="sm"
                          onPress={() => toggleMemberAdmin(m)}
                        />
                      )}
                      <Button
                        title={isSelf ? 'Me retirer' : 'Retirer'}
                        variant="danger"
                        size="sm"
                        disabled={!canRemoveSelf}
                        onPress={() => removeMember(m)}
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ─── UTILISATEURS (admin global des comptes, super admin) ─── */}
        {showGlobalUsers && (
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
                  <Button title="Gérer" variant="outline" size="sm" onPress={() => setManagedUser(u)} />
                </View>
              </Card>
            ))
          )
        )}

        {showGlobalUsers && users.length < usersTotal && (
          <Button
            title={`Charger plus (${users.length}/${usersTotal})`}
            variant="outline"
            onPress={loadMore}
            loading={loadingMore}
            style={{ marginTop: Spacing.sm }}
          />
        )}

        {/* ─── TRÉSORERIE ─── */}
        {inBdeDetail && section === 'treasury' && (
          selectedBde ? (
            <Card style={styles.treasuryCard}>
              <Text style={styles.treasuryLabel}>Solde de {selectedBde.name}</Text>
              <Text style={styles.treasuryAmount}>{(selectedBde.balance ?? 0).toFixed(2)} €</Text>
              {/* La trésorerie appartient à l'association : le super admin la
                  consulte (supervision) mais ne déplace pas l'argent d'un BDE.
                  Le retrait reste réservé aux administrateurs du BDE. */}
              {isSuperAdmin ? (
                <Text style={styles.treasuryHint}>
                  Issu des ventes de billets. Seuls les administrateurs de {selectedBde.name} peuvent
                  retirer ces fonds.
                </Text>
              ) : (
                <>
                  <Text style={styles.treasuryHint}>
                    Issu des ventes de billets. Retraits par paliers de 20 €, commission MyBDE de 5 %.
                  </Text>
                  <Button title="Retirer des fonds" onPress={withdraw} style={{ marginTop: Spacing.base }} fullWidth />
                </>
              )}
            </Card>
          ) : (
            <Empty label="Aucun BDE à gérer" />
          )
        )}

        {/* ─── CONTENU (actus) ─── */}
        {inBdeDetail && section === 'content' && (
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

      {/* Modale formulaire événement — dans la vue détail, le BDE est imposé
          (celui sélectionné), donc on masque le sélecteur en ne passant que lui. */}
      <EventFormModal
        visible={formVisible}
        form={form}
        setForm={setForm}
        saving={saving}
        managedBdes={selectedBde ? [selectedBde] : managedBdes}
        onClose={() => setFormVisible(false)}
        onSubmit={submitForm}
      />

      {/* Modale actualité */}
      <NewsModal
        visible={newsVisible}
        content={newsContent}
        setContent={setNewsContent}
        image={newsImage}
        setImage={setNewsImage}
        bdeName={selectedBde?.name ?? managedBdes.find((b) => b.id === selectedBdeId)?.name ?? ''}
        editingId={editingNewsId}
        onClose={() => setNewsVisible(false)}
        onSubmit={submitNews}
      />

      {/* Modale participants / validation QR */}
      <AttendeesModal
        visible={attendeesVisible}
        eventId={selectedEventId}
        onClose={closeAttendees}
        onChanged={markDirty}
        dialog={dialog}
      />

      {/* Modale d'administration d'un utilisateur (super admin) */}
      <UserAdminModal
        user={managedUser}
        currentUserId={user?.id ?? null}
        allBdes={allBdes}
        dialog={dialog}
        onRefresh={async () => { markDirty(); await refreshManagedUser(); }}
        onClose={() => setManagedUser(null)}
        onDeleted={async () => { markDirty(); setManagedUser(null); await loadSection(); }}
      />

      {/* Modale d'édition des informations d'un BDE (admin du BDE / super admin) */}
      <BdeAdminModal
        bde={managedBde}
        dialog={dialog}
        onUpdated={(updated) => { markDirty(); onBdeUpdated(updated); }}
        onClose={() => setManagedBde(null)}
      />

      {/* Modale de création d'un BDE avec désignation des admins (super admin) */}
      <BdeCreateModal
        visible={createBdeVisible}
        dialog={dialog}
        onClose={() => setCreateBdeVisible(false)}
        onCreated={(created) => {
          markDirty();
          setManagedBdes((prev) => [...prev, created]);
          setCreateBdeVisible(false);
          openBde(created.id);
        }}
      />
    </SafeAreaView>
  );
}

function sectionLabel(s: Section): string {
  switch (s) {
    case 'infos': return 'Infos';
    case 'events': return 'Événements';
    case 'members': return 'Utilisateurs';
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

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  dialog: ReturnType<typeof useDialog>;
}

/**
 * Sélecteur déroulant compact (remplace les rangées de chips). Cross-platform :
 * s'appuie sur dialog.choose pour présenter les options en liste, ce qui
 * fonctionne aussi bien sur mobile que sur web.
 */
function SelectField({ label, value, options, onSelect, dialog }: SelectFieldProps) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const open = () => {
    dialog.choose({
      title: label,
      choices: options.map((o) => ({ text: o.label, onPress: () => onSelect(o.value) })),
    });
  };
  return (
    <Pressable style={styles.select} onPress={open}>
      <View style={{ flex: 1 }}>
        <Text style={styles.selectLabel}>{label}</Text>
        <Text style={styles.selectValue} numberOfLines={1}>{current?.label}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={AppColors.textSecondary} />
    </Pressable>
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
  image: string;
  setImage: (v: string) => void;
  bdeName: string;
  editingId: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

const NEWS_MAX_LENGTH = 500;

function NewsModal({ visible, content, setContent, image, setImage, bdeName, editingId, onClose, onSubmit }: NewsModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 600;
  // Modale compacte : hauteur automatique (au contenu) sur desktop, plein écran
  // sur mobile. Plus besoin d'une grande carte à moitié vide.
  const cardWidth = isDesktop ? Math.min(520, Math.round(width * 0.9)) : width;
  const isEditing = !!editingId;
  const remaining = NEWS_MAX_LENGTH - content.length;

  return (
    <Modal visible={visible} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View
          style={[
            styles.modalCard,
            isDesktop ? { width: cardWidth } : StyleSheet.absoluteFillObject,
            isDesktop && styles.modalCardDesktop,
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEditing ? 'Modifier l\'actualité' : 'Nouvelle actualité'}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>

          {/* BDE cible : contexte clair de publication */}
          {!!bdeName && !isEditing && (
            <View style={styles.newsTarget}>
              <Ionicons name="megaphone-outline" size={16} color={AppColors.primary} />
              <Text style={styles.newsTargetText}>Publication pour {bdeName}</Text>
            </View>
          )}

          <View style={styles.newsFieldWrap}>
            <TextInput
              style={[styles.field, styles.newsTextarea]}
              value={content}
              onChangeText={(v) => setContent(v.slice(0, NEWS_MAX_LENGTH))}
              placeholder="Quoi de neuf au BDE ?"
              placeholderTextColor={AppColors.textLight}
              multiline
              autoFocus={isDesktop}
              maxLength={NEWS_MAX_LENGTH}
            />
            <Text style={[styles.newsCounter, remaining <= 40 && { color: AppColors.danger }]}>
              {remaining}
            </Text>
          </View>

          <View style={styles.newsImageRow}>
            <Ionicons name="image-outline" size={18} color={AppColors.textLight} />
            <TextInput
              style={styles.newsImageInput}
              value={image}
              onChangeText={setImage}
              placeholder="Lien d'une image (optionnel)"
              placeholderTextColor={AppColors.textLight}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {image.length > 0 && (
              <Pressable onPress={() => setImage('')}>
                <Ionicons name="close-circle" size={18} color={AppColors.textLight} />
              </Pressable>
            )}
          </View>

          <View style={styles.modalFooter}>
            <Button
              title={isEditing ? 'Enregistrer' : 'Publier'}
              onPress={onSubmit}
              disabled={!content.trim()}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface AttendeesModalProps {
  visible: boolean;
  eventId: string | null;
  onClose: () => void;
  onChanged?: () => void;
  dialog: ReturnType<typeof useDialog>;
}

function AttendeesModal({ visible, eventId, onClose, onChanged, dialog }: AttendeesModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(720, Math.round(height * 0.9)) : height;
  const cardWidth = isDesktop ? Math.min(640, Math.round(width * 0.9)) : width;

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
          {visible && eventId && (
            <AttendeesManager eventId={eventId} dialog={dialog} onChanged={onChanged} />
          )}
        </View>
      </View>
    </Modal>
  );
}

interface UserAdminModalProps {
  user: AdminUser | null;
  currentUserId: string | null;
  allBdes: BDE[];
  dialog: ReturnType<typeof useDialog>;
  onRefresh: () => Promise<void> | void;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
}

/**
 * Administration complète d'un utilisateur par le super admin : informations,
 * rôle global (Étudiant ↔ Super Admin), adhésions BDE (assigner, retirer, rôle
 * dans le BDE) et suppression du compte.
 */
function UserAdminModal({ user: u, currentUserId, allBdes, dialog, onRefresh, onClose, onDeleted }: UserAdminModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(720, Math.round(height * 0.9)) : height;
  const cardWidth = isDesktop ? Math.min(560, Math.round(width * 0.9)) : width;
  const isSelf = !!u && u.id === currentUserId;

  const run = async (fn: () => Promise<unknown>, errMsg: string) => {
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : errMsg });
    }
  };

  const editInfo = () => {
    if (!u) return;
    dialog.choose({
      title: 'Modifier les informations',
      choices: [
        {
          text: 'Nom affiché',
          onPress: () => dialog.prompt({
            title: 'Nom affiché', defaultValue: u.displayName,
            onSubmit: (v) => { if (v.trim()) run(() => api.updateUser(u.id, { displayName: v.trim() }), 'Mise à jour impossible'); },
          }),
        },
        {
          text: 'Téléphone',
          onPress: () => dialog.prompt({
            title: 'Téléphone', placeholder: '06 12 34 56 78', keyboardType: 'phone-pad',
            onSubmit: (v) => run(() => api.updateUser(u.id, { phone: v.trim() }), 'Mise à jour impossible'),
          }),
        },
        {
          text: 'Bio',
          onPress: () => dialog.prompt({
            title: 'Bio', placeholder: 'Quelques mots…',
            onSubmit: (v) => run(() => api.updateUser(u.id, { bio: v.trim() }), 'Mise à jour impossible'),
          }),
        },
      ],
    });
  };

  const changeRole = () => {
    if (!u) return;
    dialog.choose({
      title: 'Rôle global',
      message: `Actuel : ${ROLE_LABELS[u.role.toUpperCase()] ?? u.role}. Le statut Admin BDE s'obtient en promouvant l'utilisateur dans un BDE.`,
      choices: [
        { text: 'Étudiant', onPress: () => run(() => api.setUserRole(u.id, 'STUDENT'), 'Action impossible') },
        { text: 'Super Admin', onPress: () => run(() => api.setUserRole(u.id, 'SUPER_ADMIN'), 'Action impossible') },
      ],
    });
  };

  const assignBde = () => {
    if (!u) return;
    const joinedIds = new Set((u.bdeMembers ?? []).map((m) => m.bde.id));
    const available = allBdes.filter((b) => !joinedIds.has(b.id));
    if (available.length === 0) {
      dialog.alert({ title: 'Aucun BDE', message: 'Cet utilisateur est déjà membre de tous les BDE.' });
      return;
    }
    dialog.choose({
      title: 'Assigner à un BDE',
      choices: available.map((b) => ({
        text: b.name,
        onPress: () => run(() => api.assignUserToBde(b.id, u.id), 'Assignation impossible'),
      })),
    });
  };

  const toggleBdeRole = (bdeId: string, isAdmin: boolean) => {
    if (!u) return;
    run(() => api.setMemberAdmin(bdeId, u.id, !isAdmin), 'Action impossible');
  };

  const removeFromBde = (bdeId: string, bdeName: string) => {
    if (!u) return;
    dialog.confirm({
      title: 'Retirer du BDE',
      message: `${u.displayName} sera retiré de ${bdeName}.`,
      confirmText: 'Retirer',
      destructive: true,
      onConfirm: () => run(() => api.removeMember(bdeId, u.id), 'Action impossible'),
    });
  };

  const deleteAccount = () => {
    if (!u) return;
    dialog.confirm({
      title: 'Supprimer le compte',
      message: `Le compte de ${u.displayName} sera définitivement supprimé.`,
      confirmText: 'Supprimer',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.deleteUser(u.id);
          await onDeleted();
        } catch (e) {
          dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Suppression impossible' });
        }
      },
    });
  };

  return (
    <Modal visible={!!u} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { height: cardHeight, width: cardWidth }, isDesktop && styles.modalCardDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gérer l&apos;utilisateur</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>
          {u && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.lg }} showsVerticalScrollIndicator={false}>
              <View style={styles.itemHeader}>
                <Avatar name={u.displayName} uri={u.profilePicture} size={48} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={styles.itemTitle}>{u.displayName}{isSelf ? ' (vous)' : ''}</Text>
                  <Text style={styles.itemMeta}>{u.email}</Text>
                </View>
                <Badge
                  label={ROLE_LABELS[u.role.toUpperCase()] ?? u.role}
                  variant={u.role === 'super_admin' ? 'primary' : u.role === 'admin_bde' ? 'info' : 'neutral'}
                />
              </View>

              <Text style={styles.sectionLabel}>INFORMATIONS</Text>
              <Button title="Modifier les informations" variant="outline" size="sm" onPress={editInfo} style={{ alignSelf: 'flex-start' }} />

              {!isSelf && (
                <>
                  <Text style={styles.sectionLabel}>RÔLE GLOBAL</Text>
                  <Button title="Changer le rôle" variant="outline" size="sm" onPress={changeRole} style={{ alignSelf: 'flex-start' }} />
                </>
              )}

              <Text style={styles.sectionLabel}>BDE ({(u.bdeMembers ?? []).length})</Text>
              {(u.bdeMembers ?? []).length === 0 ? (
                <Text style={styles.itemMeta}>Aucun BDE</Text>
              ) : (
                (u.bdeMembers ?? []).map((m) => (
                  <Card key={m.bde.id} variant="outlined" style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{m.bde.name}</Text>
                        <Text style={styles.itemMeta}>{m.isAdmin ? 'Administrateur' : 'Membre'}</Text>
                      </View>
                      {m.isAdmin && <Badge label="Admin" variant="primary" size="sm" />}
                    </View>
                    <View style={styles.itemActions}>
                      <Button
                        title={m.isAdmin ? 'Rétrograder membre' : 'Promouvoir admin'}
                        variant="outline"
                        size="sm"
                        onPress={() => toggleBdeRole(m.bde.id, m.isAdmin)}
                      />
                      <Button title="Retirer" variant="danger" size="sm" onPress={() => removeFromBde(m.bde.id, m.bde.name)} />
                    </View>
                  </Card>
                ))
              )}
              <Button title="Assigner à un BDE" variant="secondary" size="sm" onPress={assignBde} style={{ alignSelf: 'flex-start', marginTop: Spacing.sm }} />

              {!isSelf && (
                <>
                  <Text style={styles.sectionLabel}>ZONE DANGEREUSE</Text>
                  <Button title="Supprimer le compte" variant="danger" size="sm" onPress={deleteAccount} style={{ alignSelf: 'flex-start' }} />
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface BdeCreateModalProps {
  visible: boolean;
  dialog: ReturnType<typeof useDialog>;
  onCreated: (created: BDE) => void;
  onClose: () => void;
}

/**
 * Création d'un BDE par le super admin, avec désignation immédiate d'un ou
 * plusieurs administrateurs. L'API les ajoute comme membres admin et les fait
 * passer au rôle ADMIN_BDE ; un utilisateur qui administre déjà un autre BDE
 * est refusé côté serveur (un admin ne gère qu'un seul BDE).
 */
function BdeCreateModal({ visible, dialog, onCreated, onClose }: BdeCreateModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(620, Math.round(height * 0.9)) : height;
  const cardWidth = isDesktop ? Math.min(540, Math.round(width * 0.9)) : width;

  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [description, setDescription] = useState('');
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!visible) return;
    setName('');
    setUniversity('');
    setDescription('');
    setAdminIds([]);
    setUserQuery('');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoadingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.getUsers({ search: userQuery.trim() || undefined, limit: 20 });
        if (!cancelled) setCandidates(res.users);
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, userQuery]);

  const selected = candidates.filter((u) => adminIds.includes(u.id));
  const canSubmit = name.trim().length > 0 && university.trim().length > 0 && !saving;

  const toggleAdmin = (id: string) =>
    setAdminIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created = await api.createBde({
        name: name.trim(),
        university: university.trim(),
        description: description.trim() || undefined,
        adminUserIds: adminIds.length > 0 ? adminIds : undefined,
      });
      onCreated(created);
    } catch (e) {
      dialog.alert({
        title: 'Création impossible',
        message: e instanceof Error ? e.message : 'Le BDE n\'a pas pu être créé',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { height: cardHeight, width: cardWidth }, isDesktop && styles.modalCardDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouveau BDE</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.sm }} keyboardShouldPersistTaps="handled">
            <Field label="Nom" value={name} onChange={setName} placeholder="BDE Informatique" />
            <Field label="Université" value={university} onChange={setUniversity} placeholder="Université de Lille" />
            <Field label="Description" value={description} onChange={setDescription} placeholder="Décrivez le BDE…" multiline />

            <Text style={styles.sectionLabel}>
              ADMINISTRATEURS {adminIds.length > 0 ? `(${adminIds.length})` : ''}
            </Text>
            <Text style={[styles.itemMeta, { marginBottom: Spacing.sm }]}>
              Facultatif. Les utilisateurs choisis passeront en rôle Admin BDE.
            </Text>

            {selected.length > 0 && (
              <View style={styles.itemActions}>
                {selected.map((u) => (
                  <Pressable key={u.id} onPress={() => toggleAdmin(u.id)} style={[styles.chip, styles.chipActive]}>
                    <Text style={[styles.chipText, styles.chipTextActive]}>{u.displayName} ✕</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={[styles.searchBox, { marginTop: Spacing.md }]}>
              <Ionicons name="search" size={18} color={AppColors.textLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un utilisateur…"
                placeholderTextColor={AppColors.textLight}
                value={userQuery}
                onChangeText={setUserQuery}
              />
            </View>

            {loadingUsers ? (
              <ActivityIndicator color={AppColors.primary} />
            ) : candidates.length === 0 ? (
              <Empty label="Aucun utilisateur" />
            ) : (
              candidates.map((u) => {
                const picked = adminIds.includes(u.id);
                return (
                  <Pressable key={u.id} onPress={() => toggleAdmin(u.id)}>
                    <Card variant="outlined" style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Avatar name={u.displayName} uri={u.profilePicture} size={36} />
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                          <Text style={styles.itemTitle}>{u.displayName}</Text>
                          <Text style={styles.itemMeta}>{u.email}</Text>
                        </View>
                        <Ionicons
                          name={picked ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={picked ? AppColors.primary : AppColors.textLight}
                        />
                      </View>
                    </Card>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.itemActions}>
            <Button title="Annuler" variant="outline" size="sm" onPress={onClose} />
            <Button
              title={saving ? 'Création…' : 'Créer le BDE'}
              size="sm"
              onPress={submit}
              disabled={!canSubmit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface BdeAdminModalProps {
  bde: BDE | null;
  dialog: ReturnType<typeof useDialog>;
  onUpdated: (updated: BDE) => void;
  onClose: () => void;
}

/**
 * Édition des informations d'un BDE (nom, université, description, statut) par
 * un admin du BDE ou le super admin — sur le modèle de l'administration d'un
 * utilisateur (UserAdminModal).
 */
function BdeAdminModal({ bde, dialog, onUpdated, onClose }: BdeAdminModalProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 600;
  const cardHeight = isDesktop ? Math.min(560, Math.round(height * 0.9)) : height;
  const cardWidth = isDesktop ? Math.min(540, Math.round(width * 0.9)) : width;

  const save = async (data: Parameters<typeof api.updateBde>[1], errMsg: string) => {
    if (!bde) return;
    try {
      const updated = await api.updateBde(bde.id, data);
      onUpdated(updated);
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : errMsg });
    }
  };

  const editName = () => bde && dialog.prompt({
    title: 'Nom du BDE', defaultValue: bde.name,
    onSubmit: (v) => { if (v.trim()) save({ name: v.trim() }, 'Mise à jour impossible'); },
  });
  const editUniversity = () => bde && dialog.prompt({
    title: 'Université', defaultValue: bde.university,
    onSubmit: (v) => { if (v.trim()) save({ university: v.trim() }, 'Mise à jour impossible'); },
  });
  const editDescription = () => bde && dialog.prompt({
    title: 'Description', defaultValue: bde.description, placeholder: 'Décrivez le BDE…',
    onSubmit: (v) => save({ description: v.trim() }, 'Mise à jour impossible'),
  });
  const changeStatus = () => bde && dialog.choose({
    title: 'Statut du BDE',
    choices: BDE_STATUSES.map((s) => ({
      text: s === 'ACTIVE' ? 'Actif' : s === 'SUSPENDED' ? 'Suspendu' : 'Inactif',
      onPress: () => save({ status: s }, 'Action impossible'),
    })),
  });

  return (
    <Modal visible={!!bde} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { height: cardHeight, width: cardWidth }, isDesktop && styles.modalCardDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifier le BDE</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </Pressable>
          </View>
          {bde && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.lg }} showsVerticalScrollIndicator={false}>
              <Text style={styles.itemTitle}>{bde.name}</Text>
              <Text style={styles.itemMeta}>{bde.university}</Text>
              {!!bde.description && <Text style={[styles.itemMeta, { marginTop: Spacing.sm }]}>{bde.description}</Text>}

              <Text style={styles.sectionLabel}>INFORMATIONS</Text>
              <View style={styles.itemActions}>
                <Button title="Nom" variant="outline" size="sm" onPress={editName} />
                <Button title="Université" variant="outline" size="sm" onPress={editUniversity} />
                <Button title="Description" variant="outline" size="sm" onPress={editDescription} />
              </View>

              <Text style={styles.sectionLabel}>STATUT</Text>
              <Button title="Changer le statut" variant="outline" size="sm" onPress={changeStatus} style={{ alignSelf: 'flex-start' }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.surface },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  title: { fontFamily: FontFamily.display, fontSize: FontSizes.xxl, color: AppColors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginBottom: Spacing.base },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: { flexGrow: 1, minWidth: 120, backgroundColor: AppColors.white, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.border, paddingVertical: Spacing.md, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.display, fontSize: FontSizes.xl, color: AppColors.primary },
  statLabel: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textSecondary, marginTop: 2 },
  filterRow: { marginBottom: Spacing.base },
  selectRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  select: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minHeight: 48,
  },
  selectLabel: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textLight },
  selectValue: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.text, marginTop: 1 },
  filterChip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: AppColors.white, borderWidth: 1, borderColor: AppColors.border, marginRight: Spacing.sm },
  filterChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  filterChipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.xs, color: AppColors.textSecondary },
  filterChipTextActive: { color: AppColors.white },
  bdeRow: { marginBottom: Spacing.sm },
  bdeChip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: AppColors.white, borderWidth: 1, borderColor: AppColors.border, marginRight: Spacing.sm },
  bdeChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  bdeChipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  bdeChipTextActive: { color: AppColors.white },
  detailHeader: { marginBottom: Spacing.sm },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: Spacing.xs, alignSelf: 'flex-start' },
  backLinkText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.primary },
  detailBdeName: { fontFamily: FontFamily.display, fontSize: FontSizes.xl, color: AppColors.text },
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
  newsTarget: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: AppColors.primaryLight, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start', marginBottom: Spacing.md },
  newsTargetText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.xs, color: AppColors.primary },
  newsFieldWrap: { position: 'relative', marginBottom: Spacing.md },
  newsTextarea: { minHeight: 120, maxHeight: 220, textAlignVertical: 'top', paddingBottom: Spacing.lg },
  newsCounter: { position: 'absolute', right: Spacing.sm, bottom: Spacing.sm, fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textLight },
  newsImageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: AppColors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.border, paddingHorizontal: Spacing.base, height: 44, marginBottom: Spacing.base },
  newsImageInput: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.text },
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
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: AppColors.white, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: AppColors.border, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  accordionTitle: { fontFamily: FontFamily.bodySemibold, fontSize: FontSizes.sm, color: AppColors.text },
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
