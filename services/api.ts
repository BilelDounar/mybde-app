import type {
  BDE,
  Event,
  NewsPost,
  Ticket,
  Order,
  BdeMember,
  WithdrawalResult,
  AdminUser,
  EventParticipant,
  AdminSummary,
} from '@/types';
import { clearSession, saveSession } from './storage';

// Données d'entrée pour créer/modifier un événement (côté gestion).
export interface EventInput {
  bdeId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  ticketTiers?: { name: string; price: number }[];
  category?: string;
  status?: string;
  image?: string | null;
  tags?: string[];
}

// Configuration API - Adapter selon l'environnement
// Pour iOS physique : remplacer par l'IP locale de votre PC (ex: 'http://192.168.1.42:3000')
// Même WiFi requis pour iOS/Android physique
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onAuthExpired: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  accessToken = token;
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
}

// Permet à AuthContext de réagir à une expiration de session non récupérable.
export function setOnAuthExpired(handler: (() => void) | null) {
  onAuthExpired = handler;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
}

async function rawRequest(endpoint: string, options: RequestInit, withAuth: boolean) {
  const headers: Record<string, string> = {
    // Fastify rejette une requête avec Content-Type: application/json et un corps
    // vide (FST_ERR_CTP_EMPTY_JSON_BODY) : on n'ajoute l'en-tête que si un corps est envoyé.
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (withAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
}

// Tente de rafraîchir l'access token via le refresh token. Renvoie true si réussi.
async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const response = await rawRequest(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
      false,
    );
    if (!response.ok) return false;
    const data: TokenPair = await response.json();
    accessToken = data.accessToken;
    refreshToken = data.refreshToken ?? refreshToken;
    await saveSession({ accessToken, refreshToken });
    return true;
  } catch {
    return false;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  opts: { auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const auth = opts.auth ?? true;
  let response = await rawRequest(endpoint, options, auth);

  // Auto-refresh transparent sur 401 (une seule tentative).
  if (response.status === 401 && auth && opts.retry !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await rawRequest(endpoint, options, true);
    } else {
      accessToken = null;
      refreshToken = null;
      await clearSession();
      if (onAuthExpired) onAuthExpired();
    }
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: 'Erreur inconnue' }));
    const message = Array.isArray(error.message)
      ? error.message.join(', ')
      : (error.message ?? 'Erreur inconnue');
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

// ─── Formes brutes renvoyées par l'API ─────────────────────

interface ApiBdeRef {
  id?: string;
  name?: string;
  logo?: string | null;
}

interface ApiTicketTier {
  id: string;
  name: string;
  price: number | string;
}

interface ApiEvent {
  id: string;
  bdeId: string;
  bde?: ApiBdeRef;
  bdeName?: string;
  title: string;
  description?: string;
  image?: string | null;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  capacity?: number;
  currentAttendees?: number;
  status?: string;
  category?: string;
  tags?: string[];
  price?: number | string;
  currency?: string;
  ticketTiers?: ApiTicketTier[];
}

interface ApiTicket {
  id: string;
  eventId: string;
  event?: {
    title?: string;
    date?: string;
    location?: string;
    image?: string | null;
  };
  ticketNumber: string;
  qrCode: string;
  status?: string;
  price?: number | string;
  purchasedAt?: string;
  purchaseDate?: string;
  ticketType?: string;
  seatInfo?: string | null;
}

interface ApiNews {
  _id?: string;
  id?: string;
  bdeName?: string;
  bdeAvatar?: string | null;
  content?: string;
  image?: string | null;
  likesCount?: number;
  commentsCount?: number;
  likedByUserIds?: string[];
  createdAt?: string;
}

interface ApiBde {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string | null;
  university?: string;
  memberCount?: number;
  balance?: number;
  _count?: { members?: number; events?: number };
  status?: string;
  joinCode?: string;
}

interface ApiOrder {
  id: string;
  eventId: string;
  eventTitle?: string;
  totalAmount?: number | string;
  currency?: string;
  quantity?: number;
  status?: string;
  createdAt?: string;
}

// ─── Mappers API → types frontend ──────────────────────────

function mapEvent(e: ApiEvent): Event {
  return {
    id: e.id,
    bdeId: e.bdeId,
    bdeName: e.bde?.name ?? e.bdeName ?? '',
    title: e.title,
    description: e.description ?? '',
    image: e.image ?? null,
    date: e.date,
    startTime: e.startTime ?? '',
    endTime: e.endTime ?? '',
    location: e.location ?? '',
    latitude: e.latitude != null ? Number(e.latitude) : null,
    longitude: e.longitude != null ? Number(e.longitude) : null,
    capacity: e.capacity ?? 0,
    currentAttendees: e.currentAttendees ?? 0,
    status: (e.status ?? 'PUBLISHED').toLowerCase() as Event['status'],
    category: (e.category ?? '').toLowerCase(),
    tags: Array.isArray(e.tags) ? e.tags : [],
    price: Number(e.price ?? 0),
    currency: e.currency ?? 'EUR',
    ticketTiers: Array.isArray(e.ticketTiers)
      ? e.ticketTiers.map((t) => ({ id: t.id, name: t.name, price: Number(t.price) }))
      : [],
  };
}

function mapTicket(t: ApiTicket): Ticket {
  return {
    id: t.id,
    eventId: t.eventId,
    eventTitle: t.event?.title ?? '',
    eventDate: t.event?.date ?? '',
    eventLocation: t.event?.location ?? '',
    eventImage: t.event?.image ?? null,
    ticketNumber: t.ticketNumber,
    qrCode: t.qrCode,
    status: (t.status ?? 'VALID').toLowerCase() as Ticket['status'],
    price: Number(t.price ?? 0),
    purchaseDate: t.purchasedAt ?? t.purchaseDate ?? '',
    ticketType: t.ticketType ?? 'Standard',
    seatInfo: t.seatInfo ?? undefined,
  };
}

function mapNews(n: ApiNews, currentUserId: string | null): NewsPost {
  const liked = Array.isArray(n.likedByUserIds) && currentUserId
    ? n.likedByUserIds.includes(currentUserId)
    : false;
  return {
    id: n._id ?? n.id ?? '',
    bdeName: n.bdeName ?? '',
    bdeAvatar: n.bdeAvatar ?? null,
    content: n.content ?? '',
    image: n.image ?? null,
    likes: n.likesCount ?? 0,
    createdAt: n.createdAt ?? '',
    isLiked: liked,
  };
}

function mapBde(b: ApiBde): BDE {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description ?? '',
    logo: b.logo ?? null,
    university: b.university ?? '',
    memberCount: b._count?.members ?? b.memberCount ?? 0,
    eventCount: b._count?.events ?? 0,
    balance: Number(b.balance ?? 0),
    status: (b.status ?? 'ACTIVE').toLowerCase() as BDE['status'],
    joinCode: b.joinCode,
  };
}

// ─── API ───────────────────────────────────────────────────

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiRequest<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, { auth: false }),

  register: (data: {
    email: string;
    password: string;
    displayName: string;
    university?: string;
    program?: string;
    year?: number;
  }) =>
    apiRequest<TokenPair>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { auth: false }),

  logout: (token: string) =>
    apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: token }),
    }, { auth: false }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string; devToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, { auth: false }),

  resetPassword: (token: string, password: string) =>
    apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }, { auth: false }),

  // Users
  getProfile: () => apiRequest<User>('/users/me'),

  updateProfile: (data: Partial<User>) =>
    apiRequest<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAccount: () =>
    apiRequest<{ message: string }>('/users/me', { method: 'DELETE' }),

  exportData: () => apiRequest<Record<string, unknown>>('/users/me/export'),

  rechargeCredits: (amount: number) =>
    apiRequest<User>('/users/me/credits', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // Events
  // Scopé aux BDE rejoints par l'utilisateur connecté (le token est transmis
  // s'il existe) : on ne force pas auth:false pour que le back sache qui appelle.
  getEvents: async (): Promise<Event[]> => {
    const data = await apiRequest<ApiEvent[]>('/events');
    return data.map(mapEvent);
  },

  getEvent: async (id: string): Promise<Event> => {
    const data = await apiRequest<ApiEvent>(`/events/${id}`, {}, { auth: false });
    return mapEvent(data);
  },

  registerToEvent: (id: string) =>
    apiRequest<unknown>(`/events/${id}/register`, { method: 'POST' }),

  purchaseTicket: async (
    id: string,
    quantity: number,
    tierId: string,
    paymentMethod: 'card' | 'balance' = 'card',
  ): Promise<{ order: Order; tickets: Ticket[]; bdeCredits: number }> => {
    const data = await apiRequest<{ order: ApiOrder; tickets: ApiTicket[]; bdeCredits?: number }>(
      `/events/${id}/purchase`,
      { method: 'POST', body: JSON.stringify({ quantity, tierId, paymentMethod }) },
    );
    return {
      bdeCredits: Number(data.bdeCredits ?? 0),
      order: {
        id: data.order.id,
        eventId: data.order.eventId,
        eventTitle: data.order.eventTitle ?? '',
        totalAmount: Number(data.order.totalAmount ?? 0),
        currency: data.order.currency ?? 'EUR',
        quantity: data.order.quantity ?? quantity,
        status: (data.order.status ?? 'COMPLETED').toLowerCase() as Order['status'],
        createdAt: data.order.createdAt ?? '',
      },
      tickets: data.tickets.map(mapTicket),
    };
  },

  // Gestion (admin)
  getManagedBdes: async (): Promise<BDE[]> => {
    const data = await apiRequest<ApiBde[]>('/bde/mine');
    return data.map(mapBde);
  },

  getAdminEvents: async (params: {
    search?: string;
    status?: string;
    category?: string;
  } = {}): Promise<Event[]> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.category) qs.set('category', params.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const data = await apiRequest<ApiEvent[]>(`/events/admin${suffix}`);
    return data.map(mapEvent);
  },

  createEvent: async (data: EventInput): Promise<Event> => {
    const res = await apiRequest<ApiEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return mapEvent(res);
  },

  updateEvent: async (id: string, data: Partial<EventInput>): Promise<Event> => {
    const res = await apiRequest<ApiEvent>(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return mapEvent(res);
  },

  deleteEvent: (id: string) =>
    apiRequest<{ message: string }>(`/events/${id}`, { method: 'DELETE' }),

  getEventParticipants: (id: string) =>
    apiRequest<EventParticipant[]>(`/events/${id}/participants`),

  getEventAttendees: (id: string) =>
    apiRequest<Array<{
      id: string;
      ticketNumber: string;
      qrCode: string;
      status: string;
      ticketType: string;
      seatInfo?: string | null;
      purchasedAt: string;
      user: { id: string; displayName: string; email: string; profilePicture?: string | null };
    }>>(`/events/${id}/attendees`),

  validateTicket: (id: string, qrCode: string) =>
    apiRequest<{
      id: string;
      ticketNumber: string;
      qrCode: string;
      status: string;
      user: { id: string; displayName: string; email: string };
    }>(`/events/${id}/validate`, { method: 'POST', body: JSON.stringify({ qrCode }) }),

  // Administration des utilisateurs (super admin)
  getUsers: (params: { search?: string; role?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.role) qs.set('role', params.role);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<AdminUser[]>(`/users${suffix}`);
  },

  setUserRole: (id: string, role: 'STUDENT' | 'ADMIN_BDE' | 'SUPER_ADMIN') =>
    apiRequest<AdminUser>(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  assignUserToBde: (bdeId: string, userId: string) =>
    apiRequest<BdeMember>(`/bde/${bdeId}/members/${userId}`, { method: 'POST' }),

  getAdminSummary: () => apiRequest<AdminSummary>('/admin/summary'),

  // Membres d'un BDE
  getBdeMembers: (bdeId: string) =>
    apiRequest<BdeMember[]>(`/bde/${bdeId}/members`),

  setMemberAdmin: (bdeId: string, userId: string, isAdmin: boolean) =>
    apiRequest<BdeMember>(`/bde/${bdeId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isAdmin }),
    }),

  removeMember: (bdeId: string, userId: string) =>
    apiRequest<{ message: string }>(`/bde/${bdeId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Trésorerie du BDE
  withdrawBdeBalance: (bdeId: string, amount: number) =>
    apiRequest<WithdrawalResult>(`/bde/${bdeId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  getBdeWithdrawals: (bdeId: string) =>
    apiRequest<WithdrawalResult[]>(`/bde/${bdeId}/withdrawals`),

  // Tickets
  getTickets: async (): Promise<Ticket[]> => {
    const data = await apiRequest<ApiTicket[]>('/tickets');
    return data.map(mapTicket);
  },

  cancelTicket: (id: string) =>
    apiRequest<{ message: string }>(`/tickets/${id}`, { method: 'DELETE' }),

  // BDE
  getBdes: async (): Promise<BDE[]> => {
    const data = await apiRequest<ApiBde[]>('/bde', {}, { auth: false });
    return data.map(mapBde);
  },

  getBde: async (id: string): Promise<BDE> => {
    const data = await apiRequest<ApiBde>(`/bde/${id}`, {}, { auth: false });
    return mapBde(data);
  },

  joinBdeByCode: (code: string) =>
    apiRequest<BdeMember>('/bde/join', { method: 'POST', body: JSON.stringify({ code }) }),

  leaveBde: (bdeId: string) =>
    apiRequest<{ message: string; refundedTicketsCount: number; refundedAmount: number; cancelledEvents: string[] }>(
      `/bde/${bdeId}/leave`,
      { method: 'DELETE' },
    ),

  regenerateBdeJoinCode: (bdeId: string) =>
    apiRequest<{ joinCode: string }>(`/bde/${bdeId}/join-code/regenerate`, { method: 'POST' }),

  // News
  getNews: async (
    currentUserId: string | null,
    bdeId?: string,
    search?: string,
  ): Promise<NewsPost[]> => {
    const qs = new URLSearchParams();
    if (bdeId) qs.set('bdeId', bdeId);
    if (search) qs.set('search', search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    // Scopé aux BDE rejoints par l'utilisateur connecté, comme getEvents.
    const data = await apiRequest<ApiNews[] | { data?: ApiNews[] }>(`/news${suffix}`);
    const list: ApiNews[] = Array.isArray(data) ? data : (data.data ?? []);
    return list.map((n) => mapNews(n, currentUserId));
  },

  toggleNewsLike: (id: string): Promise<{ liked: boolean; likesCount: number }> =>
    apiRequest<{ liked: boolean; likesCount: number }>(`/news/${id}/like`, {
      method: 'POST',
    }),

  createNews: (data: { bdeId: string; content: string; image?: string }) =>
    apiRequest<unknown>('/news', { method: 'POST', body: JSON.stringify(data) }),

  updateNews: (id: string, data: { content?: string; image?: string }) =>
    apiRequest<unknown>(`/news/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteNews: (id: string) =>
    apiRequest<{ message: string }>(`/news/${id}`, { method: 'DELETE' }),
};

// Fonction de test de connexion
export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
    });
    return response.status === 401 || response.status === 400;
  } catch {
    return false;
  }
}

// Types exportés
type User = {
  id: string;
  email: string;
  displayName: string;
  profilePicture: string | null;
  phone: string | null;
  bio: string | null;
  role: string;
  bdeCredits: number;
  university: string | null;
  program: string | null;
  year: number | null;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  privacyLevel: 'PUBLIC' | 'PRIVATE';
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: string;
  createdAt: string;
  bdeMembers: { isAdmin: boolean; bde: { id: string; name: string; logo: string | null } }[];
};

export type { User };
