import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  Linking,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageTitle } from '@/components/PageTitle';
import { JoinBdeBanner } from '@/components/JoinBdeBanner';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useTransition } from '@/context/TransitionContext';
import { useJoinBde } from '@/hooks/use-join-bde';
import { useRefreshWhenStale } from '@/hooks/use-refresh-when-stale';
import { api } from '@/services/api';

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
  // Seul un utilisateur classique achète des billets (crédits) et rejoint
  // plusieurs BDE. Un admin BDE / super admin gère les données, sans crédits.
  const isStudent = user?.role === 'student';
  const dialog = useDialog();
  const { markDirty } = useTransition();

  // Adhésions BDE et crédits changent hors de cet écran (rejoindre un BDE,
  // acheter un billet) : on relit le profil au retour sur l'onglet.
  useRefreshWhenStale(refreshUser);

  // ─── Modale d'édition du profil ────────────────────────────
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = {
    displayName: '', email: '', phone: '', university: '', program: '', year: '', bio: '',
  };
  const [form, setForm] = useState(emptyForm);
  const setField = (key: keyof typeof emptyForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openEditModal = () => {
    if (isLoading) return;
    setForm({
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      university: user?.university ?? '',
      program: user?.program ?? '',
      year: user?.year != null ? String(user.year) : '',
      bio: user?.bio ?? '',
    });
    setEditVisible(true);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSave = form.displayName.trim().length > 0 && emailValid && !saving;

  const handleSaveProfile = async () => {
    if (!canSave) return;
    const yearNum = form.year.trim() ? parseInt(form.year.trim(), 10) : undefined;
    setSaving(true);
    try {
      await updateProfile({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        university: form.university.trim() || undefined,
        program: form.program.trim() || undefined,
        year: Number.isFinite(yearNum) ? yearNum : undefined,
        bio: form.bio.trim() || undefined,
      });
      markDirty();
      setEditVisible(false);
      dialog.alert({ title: 'Succès', message: 'Profil mis à jour.' });
    } catch (e) {
      dialog.alert({
        title: 'Erreur',
        message: e instanceof Error ? e.message : 'Impossible de mettre à jour',
      });
    } finally {
      setSaving(false);
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
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.displayName ?? 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            {!!user?.phone && <Text style={styles.profileMeta}>📞 {user.phone}</Text>}
            {!!(user?.program || user?.university) && (
              <Text style={styles.profileMeta}>
                {[user?.program, user?.university].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <Pressable style={styles.editProfileBtn} onPress={openEditModal}>
            <Ionicons name="create-outline" size={16} color={AppColors.primary} />
            <Text style={styles.editProfileText}>Modifier le profil</Text>
          </Pressable>
        </Card>

        {/* Credits Card — réservé aux étudiants (achat de billets) */}
        {isStudent && (
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
        )}

        {/* BDE rejoints */}
        {bdeMembers.length === 0 ? (
          isStudent ? (
            <JoinBdeBanner
              title="Rejoins ton premier BDE"
              message="Un BDE, c'est ton accès aux actus, événements et billets de ta communauté. Sans BDE rejoint, il n'y a rien à afficher !"
            />
          ) : null
        ) : (
          <>
            <Text style={styles.sectionLabel}>MES BDE</Text>
            <Card style={styles.menuCard} padding={0}>
              {bdeMembers.map((m) => (
                <View key={m.bde.id} style={styles.bdeRow}>
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
              {/* Seuls les étudiants peuvent rejoindre plusieurs BDE. */}
              {isStudent && (
                <MenuItem
                  icon="add-circle-outline"
                  label="Rejoindre un autre BDE"
                  onPress={handleJoinBde}
                />
              )}
            </Card>
          </>
        )}

        {/* Menu Sections */}
        <Text style={styles.sectionLabel}>AIDE</Text>
        <Card style={styles.menuCard} padding={0}>
          <MenuItem
            icon="help-circle-outline"
            label="Centre d'aide"
            onPress={() => router.push({ pathname: '/info/[topic]', params: { topic: 'help' } })}
          />
          <MenuItem
            icon="chatbubbles-outline"
            label="Nous contacter"
            subtitle="support@mybde.fr"
            onPress={() => openLink('mailto:support@mybde.fr')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Conditions générales"
            onPress={() => router.push({ pathname: '/info/[topic]', params: { topic: 'terms' } })}
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

      {/* Modale d'édition des informations personnelles */}
      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <Pressable onPress={() => setEditVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={AppColors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Input
                label="Nom complet"
                placeholder="Nom Prénom"
                value={form.displayName}
                onChangeText={setField('displayName')}
                icon="person-outline"
              />
              <Input
                label="E-mail"
                placeholder="vous@universite.fr"
                value={form.email}
                onChangeText={setField('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
                error={form.email.length > 0 && !emailValid ? 'E-mail invalide' : undefined}
              />
              <Input
                label="Téléphone"
                placeholder="06 12 34 56 78"
                value={form.phone}
                onChangeText={setField('phone')}
                keyboardType="phone-pad"
                icon="call-outline"
              />
              <Input
                label="Université"
                placeholder="Université Paris-Saclay"
                value={form.university}
                onChangeText={setField('university')}
                icon="school-outline"
              />
              <Input
                label="Filière"
                placeholder="Informatique"
                value={form.program}
                onChangeText={setField('program')}
                icon="book-outline"
              />
              <Input
                label="Année d'études"
                placeholder="3"
                value={form.year}
                onChangeText={setField('year')}
                keyboardType="numeric"
                icon="calendar-outline"
              />
              <Input
                label="Bio"
                placeholder="Décrivez-vous en quelques mots"
                value={form.bio}
                onChangeText={setField('bio')}
                icon="chatbox-ellipses-outline"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                onPress={() => setEditVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Enregistrer"
                onPress={handleSaveProfile}
                loading={saving}
                disabled={!canSave}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  profileInfo: {
    marginBottom: Spacing.md,
  },
  profileName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.text,
  },
  profileEmail: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  profileMeta: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.primaryLight,
  },

  // Modale d'édition
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: AppColors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.text,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.base,
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
