import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { AppColors, BorderRadius, FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTransition } from '@/context/TransitionContext';

export const SIDEBAR_WIDTH = 248;

/**
 * Navigation latérale (sidebar) pour grand écran / desktop.
 * Remplace la tab bar en pied de page tout en réutilisant les options de
 * navigation déclarées dans `(tabs)/_layout.tsx` (titre, icône, route active).
 */
export function SidebarTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { user, logout } = useAuth();
  const { flashIfDirty } = useTransition();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.brand}>
        <Logo size={36} gradient />
        <Text style={styles.brandText}>MyBDE</Text>
      </View>

      <View style={styles.nav}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // Masque les onglets désactivés (href: null), ex. « Gestion » hors rôle admin.
          // expo-router retire `href` des options et applique tabBarItemStyle.display = 'none'.
          const itemStyle = StyleSheet.flatten(options.tabBarItemStyle);
          if (itemStyle?.display === 'none') return null;
          const focused = state.index === index;
          const label =
            typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? AppColors.primary : AppColors.textSecondary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              flashIfDirty();
              navigation.dispatch({
                ...CommonActions.navigate(route),
                target: state.key,
              });
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ hovered, pressed }) => [
                styles.item,
                hovered && !focused && styles.itemHovered,
                pressed && styles.itemPressed,
                focused && styles.itemActive,
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text style={[styles.itemLabel, { color }, focused && styles.itemLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Zone utilisateur en bas */}
      <View style={styles.footer}>
        <View style={styles.divider} />

        {/* Infos utilisateur */}
        {user && (
          <View style={styles.userRow}>
            <Avatar name={user.displayName} uri={user.profilePicture} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{user.displayName}</Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin_bde' ? 'Admin BDE' : 'Étudiant'}
              </Text>
            </View>
          </View>
        )}

        {/* Déconnexion */}
        <Pressable
          onPress={handleLogout}
          accessibilityLabel="Se déconnecter"
          style={({ hovered, pressed }) => [
            styles.item,
            hovered && styles.itemLogoutHovered,
            pressed && styles.itemLogoutPressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={22} color={AppColors.danger} />
          <Text style={styles.logoutLabel}>Se déconnecter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: AppColors.white,
    borderRightWidth: 1,
    borderRightColor: AppColors.borderLight,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.lg,
    flexDirection: 'column',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  brandText: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xl,
    color: AppColors.primary,
    letterSpacing: 0.5,
  },
  nav: {
    flex: 1,
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  itemHovered: {
    backgroundColor: AppColors.surface,
  },
  itemPressed: {
    backgroundColor: AppColors.primaryLight,
  },
  itemActive: {
    backgroundColor: AppColors.primaryLight,
  },
  itemLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.base,
  },
  itemLabelActive: {
    fontFamily: FontFamily.displaySemibold,
  },
  footer: {
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.borderLight,
    marginBottom: Spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
  },
  userName: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: FontSizes.sm,
    color: AppColors.text,
  },
  userRole: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
  },
  itemLogoutHovered: {
    backgroundColor: AppColors.dangerLight,
  },
  itemLogoutPressed: {
    backgroundColor: AppColors.dangerLight,
    opacity: 0.8,
  },
  logoutLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.base,
    color: AppColors.danger,
  },
});
