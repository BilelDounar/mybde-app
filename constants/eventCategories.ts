import type { Ionicons } from '@expo/vector-icons';

export interface EventCategoryMeta {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string];
  /** Couleur pastel utilisée pour le fond hero de la page événement. */
  heroColor: string;
}

// Source unique des catégories d'événements — utilisée pour les filtres, le
// formulaire de création (admin BDE / super admin) et les couleurs/icônes
// affichées sur les cartes événement. `value` correspond à l'enum Prisma
// `EventCategory` (en minuscules côté front, cf. mapEvent dans services/api.ts).
export const EVENT_CATEGORIES: EventCategoryMeta[] = [
  { value: 'rencontre', label: 'Rencontre', icon: 'people', gradient: ['#4A80F0', '#6D5DF6'], heroColor: '#D4C4A8' },
  { value: 'atelier', label: 'Atelier', icon: 'construct', gradient: ['#4A80F0', '#22D3EE'], heroColor: '#A8C4D4' },
  { value: 'conference', label: 'Conférence', icon: 'mic', gradient: ['#6D5DF6', '#2D2E8C'], heroColor: '#B8A8D4' },
  { value: 'soiree', label: 'Soirée', icon: 'musical-notes', gradient: ['#7C3AED', '#F471B5'], heroColor: '#D4A8C4' },
  { value: 'voyage', label: 'Voyage', icon: 'airplane', gradient: ['#10B981', '#22D3EE'], heroColor: '#A8D4B8' },
  { value: 'sport', label: 'Sport', icon: 'football', gradient: ['#F59E0B', '#EF4444'], heroColor: '#D4B8A8' },
  { value: 'solidaire', label: 'Solidaire', icon: 'heart', gradient: ['#22C55E', '#0EA5E9'], heroColor: '#A8D4CC' },
  { value: 'autre', label: 'Autre', icon: 'star', gradient: ['#4A80F0', '#6D5DF6'], heroColor: '#C4C4D4' },
];

const DEFAULT_CATEGORY = EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

export function getCategoryMeta(value: string): EventCategoryMeta {
  return EVENT_CATEGORIES.find((c) => c.value === value) ?? DEFAULT_CATEGORY;
}

// Filtre de la liste des événements ("Tout" + les catégories ci-dessus).
export const EVENT_CATEGORY_FILTERS = [
  { label: 'Tout', value: 'all' },
  ...EVENT_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
];
