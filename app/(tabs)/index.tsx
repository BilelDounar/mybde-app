import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { PageTitle } from '@/components/PageTitle';
import { JoinBdeBanner } from '@/components/JoinBdeBanner';
import { SuperAdminDashboard } from '@/components/SuperAdminDashboard';
import { AppColors, FontFamily, FontSizes, Spacing, BorderRadius } from '@/constants/theme';
import { getCategoryMeta } from '@/constants/eventCategories';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useRefreshWhenStale } from '@/hooks/use-refresh-when-stale';
import { formatRelative } from '@/services/format';
import type { Event, NewsPost } from '@/types';

export default function HomeScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  // Mobile (< 768px) : 0.4, Desktop (>= 768px) : 0.7
  const multiplier = SCREEN_WIDTH >= 768 ? 0.2 : 0.6;
  const CARD_WIDTH = SCREEN_WIDTH * multiplier;
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [news, setNews] = useState<NewsPost[]>([]);
  const firstName = (user?.displayName ?? '').trim().split(' ')[0] || 'toi';

  const loadData = useCallback(async () => {
    // Le super admin voit un tableau de bord, pas le fil scopé aux BDE rejoints.
    if (user?.role === 'super_admin') return;
    try {
      const [eventsData, newsData] = await Promise.all([
        api.getEvents(),
        api.getNews(user?.id ?? null),
      ]);
      setEvents(eventsData);
      setNews(newsData);
    } catch (e) {
      console.error('Erreur chargement accueil:', e);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Une publication faite depuis l'onglet Gestion doit apparaître ici au retour.
  useRefreshWhenStale(loadData);

  const featuredEvents = useMemo(() => {
    const published = events.filter((e) => e.status === 'published');
    if (!search.trim()) return published;
    const q = search.toLowerCase();
    return published.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.bdeName.toLowerCase().includes(q)
    );
  }, [search, events]);

  const filteredNews = useMemo(() => {
    if (!search.trim()) return news;
    const q = search.toLowerCase();
    return news.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.bdeName.toLowerCase().includes(q)
    );
  }, [search, news]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    // Mise à jour optimiste
    setNews((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    try {
      const result = await api.toggleNewsLike(postId);
      setNews((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, isLiked: result.liked, likes: result.likesCount } : p,
        ),
      );
    } catch (e) {
      console.error('Erreur like:', e);
      await loadData();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Accueil du super admin : tableau de bord global de la plateforme.
  if (user?.role === 'super_admin') {
    return <SuperAdminDashboard firstName={firstName} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageTitle title="Accueil" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Logo size={36} gradient />
            <Text style={styles.headerTitle}>MyBDE</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={AppColors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher événements, clubs, actus..."
            placeholderTextColor={AppColors.textLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {(user?.bdeMembers.length ?? 0) === 0 ? (
          <JoinBdeBanner message="Rejoins un BDE pour voir ses actus et ses événements à venir." />
        ) : (
          <>
        {/* Featured Events */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Événements à la une</Text>
          <Pressable onPress={() => router.push('/(tabs)/events')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + Spacing.md}
        >
          {featuredEvents.map((event, i) => (
            <Animated.View key={event.id} entering={FadeInRight.delay(i * 60).springify().damping(18)}>
              <Pressable
                onPress={() => router.push(`/event/${event.id}`)}
              >
                <Card style={[styles.eventCard, { width: CARD_WIDTH }]} padding={0}>
                  {/* Event Image placeholder */}
                  <LinearGradient
                    colors={getCategoryMeta(event.category).gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.eventImage}
                  >
                    <Ionicons name={getCategoryMeta(event.category).icon} size={40} color="rgba(255,255,255,0.8)" />
                    <Badge
                      label={event.category.toUpperCase()}
                      variant="primary"
                      style={styles.eventBadge}
                    />
                  </LinearGradient>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <View style={styles.eventMeta}>
                      <Ionicons name="calendar-outline" size={14} color={AppColors.textSecondary} />
                      <Text style={styles.eventMetaText}>
                        {formatDate(event.date)} · {event.location}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>

        {/* Latest News */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl }]}>
          Dernières actus
        </Text>

        {filteredNews.length === 0 && search.trim() !== '' && (
          <Text style={styles.emptySearch}>Aucun résultat pour « {search} »</Text>
        )}

        {filteredNews.map((post, i) => (
          <Animated.View key={post.id} entering={FadeInDown.delay(i * 60).springify().damping(18)} style={styles.newsCard}>
            {/* Post Header */}
            <View style={styles.postHeader}>
              <Avatar name={post.bdeName} size={42} />
              <View style={styles.postHeaderText}>
                <Text style={styles.postAuthor}>{post.bdeName}</Text>
                <Text style={styles.postTime}>{formatRelative(post.createdAt)}</Text>
              </View>
            </View>

            {/* Post Content */}
            <Text style={styles.postContent}>{post.content}</Text>

            {/* Post Image */}
            {post.image ? <NewsImage uri={post.image} /> : null}

            {/* Post Actions */}
            <View style={styles.postActions}>
              <Pressable style={styles.actionButton} onPress={() => toggleLike(post.id)}>
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={post.isLiked ? AppColors.danger : AppColors.textSecondary}
                />
                <Text style={[styles.actionText, post.isLiked && { color: AppColors.danger }]}>
                  {post.likes}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        ))}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── News image ────────────────────────────────────────────

/**
 * Image d'actualité : conserve le ratio d'origine (récupéré via Image.getSize)
 * tout en plafonnant la taille affichée (largeur et hauteur), pour éviter des
 * images démesurées tout en évitant la déformation.
 */
function NewsImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (w, h) => { if (active && h > 0) setRatio(w / h); },
      () => { if (active) setRatio(16 / 9); },
    );
    return () => { active = false; };
  }, [uri]);
  return (
    <Image
      source={{ uri }}
      style={[styles.postImage, { aspectRatio: ratio ?? 16 / 9 }]}
      resizeMode="cover"
    />
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.xl,
    color: AppColors.primary,
    letterSpacing: 0.5,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
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

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.lg,
    color: AppColors.text,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: FontSizes.sm,
    color: AppColors.primary,
    fontWeight: '600',
  },

  // Carousel
  carouselContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  eventCard: {
    overflow: 'hidden',
  },
  eventImage: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBadge: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
  },
  eventInfo: {
    padding: Spacing.md,
  },
  eventTitle: {
    fontFamily: FontFamily.displaySemibold,
    fontSize: FontSizes.md,
    color: AppColors.text,
    marginBottom: Spacing.xs,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eventMetaText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },

  // News
  newsCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.base,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  postHeaderText: {
    flex: 1,
  },
  postAuthor: {
    fontFamily: FontFamily.displaySemibold,
    fontSize: FontSizes.base,
    color: AppColors.text,
  },
  postTime: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
  },
  postContent: {
    fontSize: FontSizes.base,
    color: AppColors.text,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postImage: {
    width: '100%',
    maxWidth: 480,
    maxHeight: 360,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    backgroundColor: AppColors.surface,
  },
  emptySearch: {
    fontSize: FontSizes.sm,
    color: AppColors.textLight,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  postActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
});
