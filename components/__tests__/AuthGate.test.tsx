import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { AuthGate } from '../AuthGate';
import { AuthProvider } from '@/context/AuthContext';
import { api } from '@/services/api';
import { loadSession } from '@/services/storage';

// `Redirect` navigue au montage : hors navigateur on se contente d'observer
// qu'il est rendu, avec sa destination.
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: RNText } = jest.requireActual('react-native');
    return <RNText>redirect:{href}</RNText>;
  },
}));

jest.mock('@/services/api', () => ({
  api: { getProfile: jest.fn() },
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  setOnAuthExpired: jest.fn(),
}));

jest.mock('@/services/storage', () => ({
  loadSession: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

const mockGetProfile = api.getProfile as jest.Mock;
const mockLoadSession = loadSession as jest.Mock;

function renderGate() {
  return render(
    <AuthProvider>
      <AuthGate>
        <Text>contenu privé</Text>
      </AuthGate>
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthGate', () => {
  it('redirige vers la connexion sans session', async () => {
    mockLoadSession.mockResolvedValue(null);

    const { queryByText, findByText } = renderGate();

    expect(await findByText('redirect:/(auth)/login')).toBeTruthy();
    expect(queryByText('contenu privé')).toBeNull();
  });

  it('affiche le contenu une fois la session restaurée', async () => {
    mockLoadSession.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetProfile.mockResolvedValue({
      id: 'u1',
      email: 'a@b.fr',
      displayName: 'Alice',
      notificationsEnabled: true,
      emailNotifications: true,
      privacyLevel: 'PUBLIC',
      theme: 'SYSTEM',
      language: 'fr',
      role: 'STUDENT',
      bdeCredits: 0,
      createdAt: '2025-01-01T00:00:00Z',
    });

    const { findByText, queryByText } = renderGate();

    expect(await findByText('contenu privé')).toBeTruthy();
    expect(queryByText('redirect:/(auth)/login')).toBeNull();
  });

  it("n'affiche ni contenu ni redirection pendant la restauration", async () => {
    // Session en cours de lecture : trancher trop tôt renverrait à la connexion
    // un utilisateur pourtant connecté, à chaque rechargement de page.
    mockLoadSession.mockReturnValue(new Promise(() => {}));

    const { queryByText } = renderGate();

    await waitFor(() => {
      expect(queryByText('contenu privé')).toBeNull();
    });
    expect(queryByText('redirect:/(auth)/login')).toBeNull();
  });
});
