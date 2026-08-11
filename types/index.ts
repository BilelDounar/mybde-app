// ─── Data Models ───────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  profilePicture: string | null;
  phone: string | null;
  bio: string | null;
  // Academic info - flat structure from API
  university: string | null;
  program: string | null;
  year: number | null;
  // Keep academicInfo for backward compatibility
  academicInfo?: {
    university: string | null;
    program: string | null;
    year: number | null;
  };
  // Preferences - flat structure from API
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  privacyLevel: 'PUBLIC' | 'PRIVATE';
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: string;
  // Keep preferences for backward compatibility
  preferences?: {
    notificationsEnabled: boolean;
    emailNotifications: boolean;
    privacyLevel: 'public' | 'private';
  };
  role: 'student' | 'admin_bde' | 'super_admin';
  bdeCredits: number;
  createdAt: string;
  // BDE rejoints par l'utilisateur (potentiellement plusieurs).
  bdeMembers: { isAdmin: boolean; bde: { id: string; name: string; logo: string | null } }[];
}

export interface BDE {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  university: string;
  memberCount: number;
  eventCount?: number;
  balance?: number;
  status: 'active' | 'inactive' | 'suspended';
  // Présent uniquement sur les BDE que l'utilisateur administre (GET /bde/mine).
  joinCode?: string;
}

export interface BdeMember {
  id: string;
  userId: string;
  isAdmin: boolean;
  user: { id: string; displayName: string; email?: string; profilePicture: string | null };
}

export interface WithdrawalResult {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  feeRate: number;
  balance: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  profilePicture: string | null;
  role: 'student' | 'admin_bde' | 'super_admin';
  bdeCredits: number;
  university: string | null;
  createdAt: string;
  bdeMembers?: { isAdmin: boolean; bde: { id: string; name: string } }[];
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
}

export interface Event {
  id: string;
  bdeId: string;
  bdeName: string;
  title: string;
  description: string;
  image: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  currentAttendees: number;
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  category: string;
  tags: string[];
  price: number;
  currency: string;
  ticketTiers: TicketTier[];
}

export interface EventParticipant {
  id: string;
  displayName: string;
  profilePicture: string | null;
}

export interface AdminSummary {
  usersCount: number;
  bdesCount: number;
  eventsCount: number;
  newsCount: number;
}

export interface AdminDashboard {
  usersCount: number;
  bdesCount: number;
  activeBdesCount: number;
  newsCount: number;
  ticketsSold: number;
  upcomingEventsCount: number;
  pastEventsCount: number;
  eventsCount: number;
  usersByRole: { STUDENT: number; ADMIN_BDE: number; SUPER_ADMIN: number };
  revenue: number;
  recentUsers: {
    id: string;
    displayName: string;
    email: string;
    role: 'STUDENT' | 'ADMIN_BDE' | 'SUPER_ADMIN';
    createdAt: string;
  }[];
  topBdes: {
    id: string;
    name: string;
    logo: string | null;
    balance: number;
    memberCount: number;
    eventCount: number;
  }[];
}

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  eventImage: string | null;
  ticketNumber: string;
  qrCode: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  price: number;
  purchaseDate: string;
  ticketType: string;
  seatInfo?: string;
}

export interface NewsPost {
  id: string;
  bdeName: string;
  bdeAvatar: string | null;
  content: string;
  image: string | null;
  likes: number;
  createdAt: string;
  isLiked: boolean;
}

export interface Order {
  id: string;
  eventId: string;
  eventTitle: string;
  totalAmount: number;
  currency: string;
  quantity: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
}
