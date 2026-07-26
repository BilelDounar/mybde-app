import AsyncStorage from '@react-native-async-storage/async-storage';

// Wrapper de stockage multiplateforme (iOS/Android/Web) pour la session.
// AsyncStorage utilise localStorage sur le web et le stockage natif sur mobile.

const ACCESS_TOKEN_KEY = 'mybde.accessToken';
const REFRESH_TOKEN_KEY = 'mybde.refreshToken';

export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  return { accessToken, refreshToken };
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}
