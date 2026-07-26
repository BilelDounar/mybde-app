import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveSession, loadSession, clearSession } from '../storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('storage', () => {
  it('sauvegarde puis recharge une session complète', async () => {
    await saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    const session = await loadSession();
    expect(session).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('renvoie null quand aucun access token n’est stocké', async () => {
    expect(await loadSession()).toBeNull();
  });

  it('supprime le refresh token quand il est absent', async () => {
    await saveSession({ accessToken: 'a', refreshToken: 'r' });
    await saveSession({ accessToken: 'a2', refreshToken: null });
    const session = await loadSession();
    expect(session).toEqual({ accessToken: 'a2', refreshToken: null });
  });

  it('efface toute la session', async () => {
    await saveSession({ accessToken: 'a', refreshToken: 'r' });
    await clearSession();
    expect(await loadSession()).toBeNull();
  });
});
