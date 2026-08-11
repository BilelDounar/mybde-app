import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from '@/types';
import {
  api,
  setAuthToken,
  setRefreshToken,
  setOnAuthExpired,
  type User as ApiUser,
} from '@/services/api';
import { clearSession, loadSession, saveSession } from '@/services/storage';

// ─── Types ─────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  updatePreferences: (data: Partial<Pick<User, 'notificationsEnabled' | 'emailNotifications' | 'privacyLevel' | 'theme' | 'language'>>) => Promise<void>;
  /** Recharge le profil depuis l'API (ex. après recharge / paiement par solde). */
  refreshUser: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// Adapte la réponse API (rôle/prefs en MAJUSCULES) vers le type User de l'app.
function adaptUser(data: ApiUser): User {
  return {
    id: data.id,
    email: data.email,
    displayName: data.displayName,
    profilePicture: data.profilePicture ?? null,
    phone: data.phone ?? null,
    bio: data.bio ?? null,
    university: data.university ?? null,
    program: data.program ?? null,
    year: data.year ?? null,
    notificationsEnabled: data.notificationsEnabled,
    emailNotifications: data.emailNotifications,
    privacyLevel: data.privacyLevel as User['privacyLevel'],
    theme: data.theme as User['theme'],
    language: data.language,
    role: data.role.toLowerCase() as User['role'],
    bdeCredits: data.bdeCredits,
    createdAt: data.createdAt,
    bdeMembers: data.bdeMembers ?? [],
    preferences: {
      notificationsEnabled: data.notificationsEnabled,
      emailNotifications: data.emailNotifications,
      privacyLevel: data.privacyLevel.toLowerCase() as 'public' | 'private',
    },
    academicInfo: {
      university: data.university ?? null,
      program: data.program ?? null,
      year: data.year ?? null,
    },
  };
}

// ─── Provider ──────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restauration de la session au lancement + déconnexion auto si refresh impossible.
  useEffect(() => {
    setOnAuthExpired(() => {
      setUser(null);
    });
    (async () => {
      try {
        const session = await loadSession();
        if (session) {
          setAuthToken(session.accessToken);
          setRefreshToken(session.refreshToken);
          const userData = await api.getProfile();
          setUser(adaptUser(userData));
        }
      } catch (e) {
        console.error('Restauration session échouée:', e);
        await clearSession();
        setAuthToken(null);
        setRefreshToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => setOnAuthExpired(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.login(email, password);
      setAuthToken(response.accessToken);
      setRefreshToken(response.refreshToken ?? null);
      await saveSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? null,
      });
      const userData = await api.getProfile();
      setUser(adaptUser(userData));
    } catch (e) {
      console.error('Erreur login:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.register({ email, password, displayName: name });
      setAuthToken(response.accessToken);
      setRefreshToken(response.refreshToken ?? null);
      await saveSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? null,
      });
      const userData = await api.getProfile();
      setUser(adaptUser(userData));
    } catch (e) {
      console.error('Erreur signup:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const session = await loadSession();
    if (session?.refreshToken) {
      try {
        await api.logout(session.refreshToken);
      } catch (e) {
        console.error('Erreur logout serveur:', e);
      }
    }
    await clearSession();
    setAuthToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.getProfile();
      setUser(adaptUser(userData));
    } catch (e) {
      console.error('Erreur refreshUser:', e);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const updatedData = await api.updateProfile({
        displayName: data.displayName,
        email: data.email,
        phone: data.phone,
        bio: data.bio,
        profilePicture: data.profilePicture,
        university: data.university,
        program: data.program,
        year: data.year,
      });
      setUser(adaptUser(updatedData));
    } catch (e) {
      console.error('Erreur updateProfile:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updatePreferences = useCallback(async (data: Partial<Pick<User, 'notificationsEnabled' | 'emailNotifications' | 'privacyLevel' | 'theme' | 'language'>>) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const updatedData = await api.updateProfile({
        notificationsEnabled: data.notificationsEnabled,
        emailNotifications: data.emailNotifications,
        privacyLevel: data.privacyLevel,
        theme: data.theme,
        language: data.language,
      });
      setUser(adaptUser(updatedData));
    } catch (e) {
      console.error('Erreur updatePreferences:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
        updatePreferences,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
