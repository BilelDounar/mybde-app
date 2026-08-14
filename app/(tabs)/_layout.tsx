import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthGate } from '@/components/AuthGate';
import { HapticTab } from '@/components/haptic-tab';
import { SidebarTabBar } from '@/components/navigation/SidebarTabBar';
import { AppColors, FontSizes } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

// Au-delà de ce seuil (tablettes paysage / desktop), la navigation passe d'une
// tab bar en pied de page à une barre latérale.
const SIDEBAR_BREAKPOINT = 900;

export default function TabLayout() {
  return (
    <AuthGate>
      <TabNavigator />
    </AuthGate>
  );
}

function TabNavigator() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const useSidebar = width >= SIDEBAR_BREAKPOINT;

  const isManager = user?.role === 'admin_bde' || user?.role === 'super_admin';
  // Le super admin n'est membre d'aucun BDE : les onglets Événements et Billets
  // (scopés aux BDE rejoints) n'ont pas de sens pour lui et l'inciteraient à tort
  // à rejoindre un BDE. Il pilote tout depuis l'Accueil (dashboard) et la Gestion.
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdminBde = user?.role === 'admin_bde';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.textLight,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarPosition: useSidebar ? 'left' : 'bottom',
      }}
      tabBar={useSidebar ? (props) => <SidebarTabBar {...props} /> : undefined}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Événements',
          href: isSuperAdmin ? null : '/events',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: isAdminBde ? 'Présence' : 'Billets',
          href: isSuperAdmin ? null : '/tickets',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={isAdminBde
                ? (focused ? 'qr-code' : 'qr-code-outline')
                : (focused ? 'ticket' : 'ticket-outline')}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'Gestion',
          href: isManager ? '/manage' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'briefcase' : 'briefcase-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: AppColors.white,
    borderTopColor: AppColors.borderLight,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 8,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
});
