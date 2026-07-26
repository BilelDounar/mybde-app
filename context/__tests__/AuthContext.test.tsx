import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '@/services/api';
import { loadSession, saveSession, clearSession } from '@/services/storage';

jest.mock('@/services/api', () => ({
  api: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  setOnAuthExpired: jest.fn(),
}));

jest.mock('@/services/storage', () => ({
  loadSession: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

const mockApi = api as jest.Mocked<typeof api>;
const mockLoad = loadSession as jest.Mock;
const mockSave = saveSession as jest.Mock;
const mockClear = clearSession as jest.Mock;

const PROFILE = {
  id: 'u1',
  email: 'a@b.fr',
  displayName: 'Alice',
  profilePicture: null,
  phone: null,
  bio: null,
  university: null,
  program: null,
  year: null,
  notificationsEnabled: true,
  emailNotifications: true,
  privacyLevel: 'PUBLIC',
  theme: 'SYSTEM',
  language: 'fr',
  role: 'STUDENT',
  bdeCredits: 0,
  createdAt: '2025-01-01T00:00:00Z',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockResolvedValue(null);
  mockSave.mockResolvedValue(undefined);
  mockClear.mockResolvedValue(undefined);
});

describe('AuthContext', () => {
  it('termine le chargement sans session restaurée', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('restaure la session existante au démarrage', async () => {
    mockLoad.mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' });
    mockApi.getProfile.mockResolvedValue(PROFILE as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe('a@b.fr');
    expect(result.current.user?.role).toBe('student');
  });

  it('connecte l’utilisateur et persiste la session', async () => {
    mockApi.login.mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' } as never);
    mockApi.getProfile.mockResolvedValue(PROFILE as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('a@b.fr', 'secret');
    });

    expect(mockApi.login).toHaveBeenCalledWith('a@b.fr', 'secret');
    expect(mockSave).toHaveBeenCalledWith({ accessToken: 'acc', refreshToken: 'ref' });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('déconnecte l’utilisateur et nettoie la session', async () => {
    mockLoad.mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' });
    mockApi.getProfile.mockResolvedValue(PROFILE as never);
    mockApi.logout.mockResolvedValue({ message: 'ok' } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockApi.logout).toHaveBeenCalledWith('ref');
    expect(mockClear).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
