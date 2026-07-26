import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  api,
  ApiError,
  setAuthToken,
  setRefreshToken,
  setOnAuthExpired,
} from '../api';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const mockFetch = jest.fn();

beforeEach(async () => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  setAuthToken(null);
  setRefreshToken(null);
  setOnAuthExpired(null);
  await AsyncStorage.clear();
});

describe('api.getEvents', () => {
  it('mappe les événements bruts vers le type frontend', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'e1',
          bdeId: 'b1',
          bde: { name: 'BDE Test' },
          title: 'Soirée',
          date: '2025-01-01',
          status: 'PUBLISHED',
          category: 'PARTY',
          price: '15.5',
        },
      ]),
    );

    const events = await api.getEvents();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/events',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'e1',
      bdeName: 'BDE Test',
      status: 'published',
      category: 'party',
      price: 15.5,
      currency: 'EUR',
    });
  });
});

describe('api.login', () => {
  it('envoie les identifiants sans en-tête Authorization', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ accessToken: 'acc', refreshToken: 'ref' }),
    );

    const result = await api.login('a@b.fr', 'secret');

    expect(result).toEqual({ accessToken: 'acc', refreshToken: 'ref' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.fr', password: 'secret' });
  });
});

describe('auto-refresh sur 401', () => {
  it('rafraîchit le token puis rejoue la requête initiale', async () => {
    setAuthToken('expired');
    setRefreshToken('valid-refresh');

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-acc', refreshToken: 'new-ref' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'u1', email: 'a@b.fr' }));

    const profile = await api.getProfile();

    expect(profile).toMatchObject({ id: 'u1' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // La requête rejouée porte le nouvel access token.
    const [, retryOptions] = mockFetch.mock.calls[2];
    expect(retryOptions.headers.Authorization).toBe('Bearer new-acc');
  });

  it('déclenche onAuthExpired quand le refresh échoue', async () => {
    setAuthToken('expired');
    setRefreshToken('bad-refresh');
    const onExpired = jest.fn();
    setOnAuthExpired(onExpired);

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'Invalid refresh' }, 401));

    await expect(api.getProfile()).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});

describe('api.getAdminEvents', () => {
  it('construit la query de recherche et mappe les événements', async () => {
    setAuthToken('tok');
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: 'e1', bdeId: 'b1', title: 'Gala', status: 'DRAFT' }]),
    );

    const events = await api.getAdminEvents({ search: 'gala' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/events/admin?search=gala');
    expect(events[0]).toMatchObject({ id: 'e1', status: 'draft' });
  });
});

describe('api.getUsers', () => {
  it('passe search et role en query', async () => {
    setAuthToken('tok');
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await api.getUsers({ search: 'bilel', role: 'STUDENT' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/users?search=bilel&role=STUDENT');
  });
});

describe('api.withdrawBdeBalance', () => {
  it('poste le montant et renvoie le détail de commission', async () => {
    setAuthToken('tok');
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'w1', amount: 40, fee: 2, netAmount: 38, feeRate: 0.05, balance: 60 }),
    );

    const res = await api.withdrawBdeBalance('b1', 40);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/bde/b1/withdraw');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ amount: 40 });
    expect(res).toMatchObject({ netAmount: 38, fee: 2, balance: 60 });
  });
});

describe('api.setUserRole', () => {
  it('envoie le nouveau rôle en PATCH', async () => {
    setAuthToken('tok');
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'u1', role: 'admin_bde' }));

    await api.setUserRole('u1', 'ADMIN_BDE');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/users/u1/role');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ role: 'ADMIN_BDE' });
  });
});

describe('api.getNews', () => {
  it('gère une réponse paginée { data: [...] } et calcule isLiked', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            _id: 'n1',
            content: 'Hello',
            likesCount: 3,
            likedByUserIds: ['u1', 'u2'],
            createdAt: '2025-01-01T00:00:00Z',
          },
        ],
      }),
    );

    const news = await api.getNews('u1');

    expect(news[0]).toMatchObject({ id: 'n1', likes: 3, isLiked: true });
  });
});
