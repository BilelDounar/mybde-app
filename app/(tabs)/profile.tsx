import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageTitle } from '@/components/PageTitle';
import { JoinBdeBanner } from '@/components/JoinBdeBanner';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useTransition } from '@/context/TransitionContext';
import { useJoinBde } from '@/hooks/use-join-bde';
import { api, testConnection } from '@/services/api';
import type { Ticket } from '@/types';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
}

function MenuItem({ icon, label, subtitle, onPress, danger, badge }: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? AppColors.danger : AppColors.primary}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={AppColors.textLight} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout, updateProfile, refreshUser, isLoading } = useAuth();
  const bdeMembers = user?.bdeMembers ?? [];
  const dialog = useDialog();
  const { markDirty } = useTransition();
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const showApiFlag = __DEV__ && user?.role === 'super_admin';

  useEffect(() => {
    if (showApiFlag) testConnection().then(setApiConnected);
    api.getTickets().then(setTickets).catch((e) => console.error('Erreur billets profil:', e));
  }, [showApiFlag]);

  const saveProfileField = async (
    data: Parameters<typeof updateProfile>[0],
    successMessage: string,
  ) => {
    try {
      await updateProfile(data);
      markDirty();
      dialog.alert({ title: 'Succès', message: successMessage });
    } catch (e) {
      dialog.alert({
        title: 'Erreur',
        message: e instanceof Error ? e.message : 'Impossible de mettre à jour',
      });
    }
  };

  const openLink = async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener');
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        dialog.alert({ title: 'Erreur', message: `Impossible d'ouvrir ${url}` });
      }
    } catch {
      dialog.alert({ title: 'Erreur', message: 'Une erreur est survenue' });
    }
  };

  const handleShareApp = async () => {
    const message = "Rejoins-moi sur MyBDE ! L'app des étudiants.";
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title: 'MyBDE', text: message });
        } else if (nav?.clipboard) {
          await nav.clipboard.writeText(message);
          dialog.alert({ title: 'Lien copié', message: "Le message d'invitation a été copié." });
        } else {
          dialog.alert({ title: 'MyBDE', message });
        }
        return;
      }
      await Share.share({ title: 'MyBDE', message });
    } catch {
      dialog.alert({ title: 'Erreur', message: 'Impossible de partager.' });
    }
  };

  const handleExportData = () => {
    dialog.confirm({
      title: 'Exporter mes données (RGPD)',
      message: 'Récupérer une copie de vos données personnelles ?',
      confirmText: 'Exporter',
      onConfirm: async () => {
        try {
          const data = await api.exportData();
          const json = JSON.stringify(data, null, 2);
          if (Platform.OS === 'web') {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'mybde-export.json';
            link.click();
            URL.revokeObjectURL(url);
          } else {
            await Share.share({ title: 'Export MyBDE', message: json });
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Export impossible';
          dialog.alert({ title: 'Erreur', message });
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    dialog.confirm({
      title: 'Supprimer mon compte',
      message: 'Cette action est irréversible. Toutes vos données seront supprimées. Continuer ?',
      confirmText: 'Supprimer',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.deleteAccount();
          await logout();
          router.replace('/(auth)/login');
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Suppression impossible';
          dialog.alert({ title: 'Erreur', message });
        }
      },
    });
  };

  const handleUpdatePersonalInfo = () => {
    if (isLoading) return;
    dialog.choose({
      title: 'Informations personnelles',
      message: 'Que souhaitez-vous modifier ?',
      choices: [
        {
          text: 'Modifier le téléphone',
          onPress: () =>
            dialog.prompt({
              title: 'Numéro de téléphone',
              message: 'Entrez votre numéro :',
              placeholder: '06 12 34 56 78',
              defaultValue: user?.phone ?? '',
              keyboardType: 'phone-pad',
              onSubmit: (phone) => {
                if (phone.trim()) saveProfileField({ phone: phone.trim() }, 'Numéro mis à jour');
              },
            }),
        },
        {
          text: 'Modifier la bio',
          onPress: () =>
            dialog.prompt({
              title: 'Bio',
              message: 'Décrivez-vous :',
              placeholder: 'Votre bio',
              defaultValue: user?.bio ?? '',
              onSubmit: (bio) => {
                if (bio.trim()) saveProfileField({ bio: bio.trim() }, 'Bio mise à jour');
              },
            }),
        },
      ],
    });
  };

  const handleUpdateAcademicInfo = () => {
    if (isLoading) return;
    dialog.choose({
      title: 'Infos académiques',
      message: 'Que souhaitez-vous modifier ?',
      choices: [
        {
          text: 'Modifier la formation',
          onPress: () =>
            dialog.prompt({
              title: 'Formation',
              message: 'Entrez votre formation :',
              placeholder: 'Ex. Informatique',
              defaultValue: user?.program ?? '',
              onSubmit: (program) => {
                if (program.trim()) saveProfileField({ program: program.trim() }, 'Formation mise à jour');
              },
            }),
        },
        {
          text: "Modifier l'université",
          onPress: () =>
            dialog.prompt({
              title: 'Université',
              message: 'Entrez votre université :',
              placeholder: 'Ex. Université Paris-Saclay',
              defaultValue: user?.university ?? '',
              onSubmit: (university) => {
                if (university.trim()) saveProfileField({ university: university.trim() }, 'Université mise à jour');
              },
            }),
        },
      ],
    });
  };

  const handleLogout = () => {
    dialog.confirm({
      title: 'Déconnexion',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      confirmText: 'Se déconnecter',
      destructive: true,
      onConfirm: async () => {
        await logout();
        router.replace('/(auth)/login');
      },
    });
  };

  const handleRecharge = () => router.push('/recharge');
  const handleJoinBde = useJoinBde();

  const handleLeaveBde = (bdeId: string, bdeName: string) => {
    dialog.confirm({
      title: `Quitter ${bdeName} ?`,
      message: "Vos billets valides pour des événements à venir de ce BDE seront automatiquement annulés et remboursés sur votre solde. L'historique de vos billets passés reste conservé.",
      confirmText: 'Quitter',
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await api.leaveBde(bdeId);
          markDirty();
          await refreshUser();
          const refundNote =
            res.refundedTicketsCount > 0
              ? ` ${res.refundedTicketsCount} billet(s) annulé(s), ${res.refundedAmount.toFixed(2)}€ remboursés sur votre solde.`
              : '';
          dialog.alert({ title: 'BDE quitté', message: `Vous avez quitté ${bdeName}.${refundNote}` });
        } catch (e) {
          dialog.alert({
            title: 'Erreur',
            message: e instanceof Error ? e.message : 'Impossible de quitter ce BDE',
          });
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Profil" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
          {showApiFlag && (
            <Pressable
              onPress={() => testConnection().then(setApiConnected)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: apiConnected === null ? AppColors.surface : apiConnected ? '#d1fae5' : '#fee2e2',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: apiConnected === null ? AppColors.textLight : apiConnected ? '#10b981' : '#ef4444',
                marginRight: 4,
              }} />
              <Text style={{
                fontSize: 10,
                color: apiConnected === null ? AppColors.textLight : apiConnected ? '#047857' : '#dc2626',
                fontWeight: '600',
              }}>
                {apiConnected === null ? '...' : apiConnected ? 'API' : 'OFF'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={user?.displayName ?? 'User'} size={64} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.displayName ?? 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
              <View style={styles.profileBadge}>
                <Ionicons name="school-outline" size={12} color={AppColors.primary} />
                <Text style={styles.profileBadgeText}>
                  {user?.program ?? 'Étudiant'} · Année {user?.year ?? '-'}
                </Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.editProfileBtn} onPress={handleUpdatePersonalInfo}>
            <Text style={styles.editProfileText}>Modifier le profil</Text>
          </Pressable>
        </Card>

        {/* Credits Card */}
        <Card style={styles.creditsCard}>
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
            <Button
              title="Recharger"
              onPress={handleRecharge}
              size="sm"
              variant="secondary"
              icon={<Ionicons name="add-circle-outline" size={16} color={AppColors.primary} />}
            />
          </View>
        </Card>

        {/* BDE rejoints */}
        {bdeMembers.length === 0 ? (
          <JoinBdeBanner
            title="Rejoins ton premier BDE"
            message="Un BDE, c'est ton accès aux actus, événements et billets de ta communauté. Sans BDE rejoint, il n'y a rien à afficher !"
          />
        ) : (
          <>
            <Text style={styles.sectionLabel}>MES BDE</Text>
            <Card style={styles.menuCard} padding={0}>
              {bdeMembers.map((m) => (
                <View key={m.bde.id} style={styles.bdeRow}>
                  <Avatar name={m.bde.name} size={36} uri={m.bde.logo ?? undefined} />
                  <View style={styles.menuContent}>
                    <Text style={styles.menuLabel}>{m.bde.name}</Text>
                    {m.isAdmin && <Text style={styles.menuSubtitle}>Administrateur</Text>}
                  </View>
                  {!m.isAdmin && (
                    <Pressable
                      style={styles.bdeLeaveBtn}
                      onPress={() => handleLeaveBde(m.bde.id, m.bde.name)}
                    >
                      <Text style={styles.bdeLeaveBtnText}>Quitter</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <MenuItem
                icon="add-circle-outline"
                label="Rejoindre un autre BDE"
                onPress={handleJoinBde}
              />
            </Card>
          </>
        )}

        {/* Stats Row */}
        {(() => {
          const upcomingTickets = tickets.filter(t => t.status === 'valid').length;
          const pastTickets = tickets.filter(t => t.status === 'used').length;
          const bdeJoined = bdeMembers.length;
          return (
            <View style={styles.statsRow}>
              <Pressable style={styles.statItem} onPress={() => router.push('/(tabs)/tickets')}>
                <Text style={styles.statNumber}>{upcomingTickets}</Text>
                <Text style={styles.statLabel}>À venir</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <Pressable style={styles.statItem} onPress={() => router.push('/(tabs)/tickets')}>
                <Text style={styles.statNumber}>{pastTickets}</Text>
                <Text style={styles.statLabel}>Passés</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <Pressable style={styles.statItem} onPress={() => router.push('/(tabs)/events')}>
                <Text style={styles.statNumber}>{bdeJoined}</Text>
                <Text style={styles.statLabel}>BDE</Text>
              </Pressable>
            </View>
          );
        })()}

        {/* Menu Sections */}
        <Text style={styles.sectionLabel}>COMPTE</Text>
        <Card style={styles.menuCard} padding={0}>
          <MenuItem
            icon="person-outline"
            label="Informations personnelles"
            subtitle={user?.phone ? `📞 ${user.phone}` : 'Nom, e-mail, téléphone'}
            onPress={handleUpdatePersonalInfo}
          />
          <MenuItem
            icon="school-outline"
            label="Infos académiques"
            subtitle={user?.university ? `${user.university}` : 'Université, formation'}
            onPress={handleUpdateAcademicInfo}
          />
        </Card>

        <Text style={styles.sectionLabel}>AIDE</Text>
        <Card style={styles.menuCard} padding={0}>
          <MenuItem
            icon="help-circle-outline"
            label="Centre d'aide"
            onPress={() => openLink('https://mybde.fr/help')}
          />
          <MenuItem
            icon="chatbubbles-outline"
            label="Nous contacter"
            onPress={() => openLink('mailto:support@mybde.fr')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Conditions générales"
            onPress={() => openLink('https://mybde.fr/terms')}
          />
          <MenuItem
            icon="share-outline"
            label="Partager l'app"
            onPress={handleShareApp}
          />
        </Card>

        <Text style={styles.sectionLabel}>DONNÉES PERSONNELLES</Text>
        <Card style={styles.menuCard} padding={0}>
          <MenuItem
            icon="download-outline"
            label="Exporter mes données (RGPD)"
            subtitle="Télécharger une copie de vos données"
            onPress={handleExportData}
          />
          <MenuItem
            icon="trash-outline"
            label="Supprimer mon compte"
            subtitle="Suppression définitive de vos données"
            onPress={handleDeleteAccount}
            danger
          />
        </Card>

        {/* Logout */}
        <Card style={[styles.menuCard, { marginTop: Spacing.lg }]} padding={0}>
          <MenuItem
            icon="log-out-outline"
            label="Se déconnecter"
            onPress={handleLogout}
            danger
          />
        </Card>

        <Text style={styles.versionText}>MyBDE v1.0.0</Text>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: AppColors.background,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.text,
  },

  // Profile
  profileCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    padding: Spacing.base,
  },
  profileRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.md,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.text,
  },
  profileEmail: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginBottom: Spacing.xs,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  profileBadgeText: {
    fontSize: FontSizes.xs,
    color: AppColors.primary,
    fontWeight: '500',
  },
  editProfileBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.primaryLight,
  },
  editProfileText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.primary,
  },

  // Credits Card
  creditsCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: AppColors.primary,
    borderWidth: 0,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  creditsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  creditsAmount: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: AppColors.white,
  },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rechargeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.white,
  },

  bdeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  bdeLeaveBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.dangerLight,
  },
  bdeLeaveBtnText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.danger,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: AppColors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: AppColors.text,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: AppColors.borderLight,
  },

  // Sections
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textLight,
    letterSpacing: 1,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Menu
  menuCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: {
    backgroundColor: AppColors.dangerLight,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FontSizes.base,
    fontWeight: '500',
    color: AppColors.text,
  },
  menuLabelDanger: {
    color: AppColors.danger,
  },
  menuSubtitle: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    marginTop: 1,
  },
  menuBadge: {
    backgroundColor: AppColors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  menuBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.success,
  },
  versionText: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
    marginTop: Spacing.xl,
  },
});
