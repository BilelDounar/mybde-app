import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageTitle } from '@/components/PageTitle';
import { JoinBdeBanner } from '@/components/JoinBdeBanner';
import { AppColors, FontFamily, FontSizes, Gradients, Spacing, BorderRadius } from '@/constants/theme';
import { EVENT_CATEGORY_FILTERS, getCategoryMeta } from '@/constants/eventCategories';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import type { Event } from '@/types';

export default function EventsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await api.getEvents());
    } catch (e) {
      console.error('Erreur chargement événements:', e);
    }
  }, []);

  useEffect(() => {
    loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        search.trim() === '' ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.location.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || event.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, events]);

  const renderEvent = ({ item, index }: { item: Event; index: number }) => {
    const spotsLeft = item.capacity - item.currentAttendees;
    const fillPercent = (item.currentAttendees / item.capacity) * 100;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}>
      <Pressable
        style={styles.eventRow}
        onPress={() => router.push(`/event/${item.id}`)}
      >
        {/* Image placeholder */}
        <LinearGradient
          colors={getCategoryMeta(item.category).gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.eventThumb}
        >
          <Ionicons name={getCategoryMeta(item.category).icon} size={24} color="rgba(255,255,255,0.9)" />
        </LinearGradient>

        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={AppColors.textSecondary} />
            <Text style={styles.metaText}>
              {formatDate(item.date)} · {item.startTime}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={AppColors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.price}>
              {item.price === 0 ? 'Gratuit' : `${item.price.toFixed(2)}€`}
            </Text>
            <View style={styles.spotsContainer}>
              <View style={styles.spotsBar}>
                <View style={[styles.spotsFill, { width: `${Math.min(fillPercent, 100)}%` }]} />
              </View>
              <Text style={styles.spotsText}>{spotsLeft} restant{spotsLeft !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Événements" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Événements</Text>
        <Pressable
          style={styles.filterButton}
          onPress={() =>
            Alert.alert('Filtres avancés', 'Les filtres par date, prix et statut seront disponibles prochainement.')
          }
        >
          <Ionicons name="options-outline" size={22} color={AppColors.text} />
        </Pressable>
      </View>

      {!loading && (user?.bdeMembers.length ?? 0) === 0 ? (
        <JoinBdeBanner message="Rejoins un BDE pour découvrir ses événements à venir." />
      ) : (
        <>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={AppColors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou lieu..."
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

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesRow}
      >
        {EVENT_CATEGORY_FILTERS.map((cat) => {
          const active = selectedCategory === cat.value;
          return (
            <Pressable
              key={cat.value}
              style={styles.categoryChip}
              onPress={() => setSelectedCategory(cat.value)}
            >
              {active && (
                <LinearGradient
                  colors={Gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Result count */}
      <Text style={styles.resultCount}>
        {filteredEvents.length} événement{filteredEvents.length !== 1 ? 's' : ''} trouvé{filteredEvents.length !== 1 ? 's' : ''}
      </Text>

      {/* Events List */}
      <FlatList
        data={filteredEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={AppColors.textLight} />
              <Text style={styles.emptyTitle}>Aucun événement trouvé</Text>
              <Text style={styles.emptyText}>Essayez d&apos;ajuster votre recherche ou vos filtres</Text>
            </View>
          )
        }
      />
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xxl,
    color: AppColors.text,
    letterSpacing: -0.5,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: AppColors.surface,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.base,
    color: AppColors.text,
  },
  categoriesScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: Spacing.md,
  },
  categoriesRow: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  categoryChip: {
    height: 36,
    paddingHorizontal: Spacing.base,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: AppColors.surface,
    overflow: 'hidden',
  },
  categoryText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
  categoryTextActive: {
    fontFamily: FontFamily.bodySemibold,
    color: AppColors.white,
  },
  resultCount: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  eventThumb: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  eventTitle: {
    fontFamily: FontFamily.displaySemibold,
    fontSize: FontSizes.md,
    color: AppColors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: AppColors.primary,
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  spotsBar: {
    width: 50,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.borderLight,
    overflow: 'hidden',
  },
  spotsFill: {
    height: '100%',
    backgroundColor: AppColors.success,
    borderRadius: 2,
  },
  spotsText: {
    fontSize: FontSizes.xs,
    color: AppColors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.text,
  },
  emptyText: {
    fontSize: FontSizes.base,
    color: AppColors.textSecondary,
  },
});
