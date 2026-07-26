import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { SidebarTabBar } from '@/components/navigation/SidebarTabBar';
import { AppColors, FontSizes } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

// Au-delà de ce seuil (tablettes paysage / desktop), la navigation passe d'une
// tab bar en pied de page à une barre latérale.
const SIDEBAR_BREAKPOINT = 900;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const useSidebar = width >= SIDEBAR_BREAKPOINT;
  const isManager = user?.role === 'admin_bde' || user?.role === 'super_admin';

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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Billets',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'ticket' : 'ticket-outline'}
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
