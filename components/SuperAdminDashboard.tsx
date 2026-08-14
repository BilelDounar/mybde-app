import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { AppColors, BorderRadius, FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { api } from '@/services/api';
import { useRefreshWhenStale } from '@/hooks/use-refresh-when-stale';
import type { AdminDashboard } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Étudiants',
  ADMIN_BDE: 'Admins BDE',
  SUPER_ADMIN: 'Super admins',
};

/**
 * Accueil du super admin : un tableau de bord de l'usage global de la plateforme
 * (compteurs, répartition des rôles, revenu, activité récente) plutôt que le fil
 * d'actualités, qui n'a pas de sens sans BDE rejoint.
 */
export function SuperAdminDashboard({ firstName }: { firstName: string }) {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.getAdminDashboard());
    } catch (e) {
      console.error('Erreur dashboard admin:', e);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Compteurs de la plateforme : à recharger dès qu'une écriture a eu lieu.
  useRefreshWhenStale(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </SafeAreaView>
    );
  }

  const totalUsers = data?.usersCount ?? 0;
  const roleEntries = (['STUDENT', 'ADMIN_BDE', 'SUPER_ADMIN'] as const).map((role) => ({
    role,
    count: data?.usersByRole?.[role] ?? 0,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Tableau de bord" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />
        }
      >
        <Text style={styles.hello}>Bonjour {firstName},</Text>
        <Text style={styles.subtitle}>Vue d&apos;ensemble de la plateforme MyBDE</Text>

        {/* Compteurs clés */}
        <View style={styles.statsGrid}>
          <StatCard icon="people-outline" label="Utilisateurs" value={totalUsers} />
          <StatCard icon="business-outline" label="BDE actifs" value={data?.activeBdesCount ?? 0} sub={`${data?.bdesCount ?? 0} au total`} />
          <StatCard icon="calendar-outline" label="Événements à venir" value={data?.upcomingEventsCount ?? 0} sub={`${data?.pastEventsCount ?? 0} passés`} />
          <StatCard icon="ticket-outline" label="Billets émis" value={data?.ticketsSold ?? 0} />
          <StatCard icon="megaphone-outline" label="Actualités" value={data?.newsCount ?? 0} />
          <StatCard icon="cash-outline" label="Revenu plateforme" value={`${(data?.revenue ?? 0).toFixed(2)} €`} />
        </View>

        {/* Répartition des rôles */}
        <Text style={styles.sectionLabel}>RÉPARTITION DES UTILISATEURS</Text>
        <Card style={styles.card}>
          {roleEntries.map(({ role, count }) => {
            const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
            return (
              <View key={role} style={styles.roleRow}>
                <View style={styles.roleHeader}>
                  <Text style={styles.roleLabel}>{ROLE_LABELS[role]}</Text>
                  <Text style={styles.roleValue}>{count} · {pct}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
        </Card>

        {/* BDE les plus actifs */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>BDE LES PLUS ACTIFS</Text>
          <Pressable onPress={() => router.push('/(tabs)/manage')}>
            <Text style={styles.seeAll}>Gérer</Text>
          </Pressable>
        </View>
        <Card style={styles.card} padding={0}>
          {(data?.topBdes ?? []).length === 0 ? (
            <Text style={styles.empty}>Aucun BDE pour le moment</Text>
          ) : (
            (data?.topBdes ?? []).map((bde) => (
              <View key={bde.id} style={styles.listRow}>
                <Avatar name={bde.name} uri={bde.logo ?? undefined} size={40} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={styles.listTitle}>{bde.name}</Text>
                  <Text style={styles.listMeta}>
                    {bde.memberCount} membre{bde.memberCount > 1 ? 's' : ''} · {bde.eventCount} événement{bde.eventCount > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.listAmount}>{(bde.balance ?? 0).toFixed(0)} €</Text>
              </View>
            ))
          )}
        </Card>

        {/* Derniers inscrits */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>DERNIERS INSCRITS</Text>
          <Pressable onPress={() => router.push('/(tabs)/manage')}>
            <Text style={styles.seeAll}>Utilisateurs</Text>
          </Pressable>
        </View>
        <Card style={styles.card} padding={0}>
          {(data?.recentUsers ?? []).length === 0 ? (
            <Text style={styles.empty}>Aucun inscrit</Text>
          ) : (
            (data?.recentUsers ?? []).map((u) => (
              <View key={u.id} style={styles.listRow}>
                <Avatar name={u.displayName} size={36} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={styles.listTitle}>{u.displayName}</Text>
                  <Text style={styles.listMeta}>{u.email}</Text>
                </View>
                <Text style={styles.listDate}>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                </Text>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={AppColors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  hello: { fontFamily: FontFamily.display, fontSize: FontSizes.xxl, color: AppColors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: {
    flexGrow: 1,
    minWidth: 150,
    flexBasis: '30%',
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.base,
    gap: 2,
  },
  statValue: { fontFamily: FontFamily.display, fontSize: FontSizes.xxl, color: AppColors.text, marginTop: Spacing.xs },
  statLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  statSub: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textLight },
  sectionLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.xs, color: AppColors.textLight, letterSpacing: 1, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { fontFamily: FontFamily.bodySemibold, fontSize: FontSizes.sm, color: AppColors.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  card: { marginBottom: Spacing.sm },
  roleRow: { marginBottom: Spacing.md },
  roleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  roleLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: AppColors.text },
  roleValue: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: AppColors.surface, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: AppColors.primary },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  listTitle: { fontFamily: FontFamily.displaySemibold, fontSize: FontSizes.base, color: AppColors.text },
  listMeta: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginTop: 1 },
  listAmount: { fontFamily: FontFamily.displaySemibold, fontSize: FontSizes.base, color: AppColors.primary },
  listDate: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: AppColors.textLight },
  empty: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textLight, textAlign: 'center', padding: Spacing.lg },
});
