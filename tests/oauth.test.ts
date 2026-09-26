import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callbackCode, validateRedirect } from '../src/core/oauth-policy';
import { login, refreshAccessToken, logout } from '../src/core/auth';
import { syncProgress } from '../src/core/api';
const id = 'a'.repeat(32);
const redirect = `https://${id}.chromiumapp.org/oauth2`;
let storage: Record<string, unknown>;
let launch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  storage = {};
  launch = vi.fn(async ({ url }: { url: string }) => `${redirect}?state=${new URL(url).searchParams.get('state')}&code=one-time-code`);
  vi.stubGlobal('chrome', {
    runtime: { id }, identity: { getRedirectURL: () => redirect, launchWebAuthFlow: launch },
    storage: { local: {
      get: vi.fn(async () => structuredClone(storage)), setAccessLevel: vi.fn(async () => {}),
      set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(storage, value); }),
      remove: vi.fn(async (key: string) => { delete storage[key]; }),
    } },
  });
});
describe('OAuth callback and public client', () => {
  it('uses PKCE S256, a public client, and exactly the runtime redirect', async () => {
    const fetchMock = vi.fn(async () => Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    await login();
    const auth = new URL(launch.mock.calls[0][0].url);
    expect(auth.searchParams.get('client_id')).toBe('branilist-sync');
    expect(auth.searchParams.get('redirect_uri')).toBe(redirect);
    expect(auth.searchParams.get('code_challenge_method')).toBe('S256');
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get('client_secret')).toBeNull();
    expect(body.get('client_id')).toBe('branilist-sync');
    expect(body.get('redirect_uri')).toBe(redirect);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.get('code_verifier')!));
    expect(Buffer.from(hash).toString('base64url')).toBe(auth.searchParams.get('code_challenge'));
  });
  it.each([
    'https://evil.test/oauth2?state=expected&code=code',
    `${redirect}/wrong?state=expected&code=code`,
    `${redirect}?state=other&code=code`,
    `${redirect}?state=expected&state=expected&code=code`,
    `${redirect}?state=expected&code=one&code=two`,
    `${redirect}?state=expected&error=access_denied&code=code`,
    `${redirect}?state=expected&code=code#fragment`,
  ])('rejects invalid callback %s', result => {
    expect(() => callbackCode(result, redirect, 'expected')).toThrow();
  });
  it('does not exchange a code from an invalid callback', async () => {
    launch.mockResolvedValue('https://evil.test/oauth2?code=code');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(login()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a mismatched runtime ID', () => {
    expect(() => validateRedirect(redirect, 'b'.repeat(32))).toThrow();
    expect(() => validateRedirect(redirect, id)).not.toThrow();
  });
  it('preserves refresh credentials on transient errors', async () => {
    storage['branilist.auth'] = { accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 };
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(refreshAccessToken()).rejects.toThrow();
    expect(storage['branilist.auth']).toBeDefined();
  });
  it('clears invalid grants and local logout succeeds offline', async () => {
    storage['branilist.auth'] = { accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 };
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
    await expect(refreshAccessToken()).rejects.toThrow();
    expect(storage['branilist.auth']).toBeUndefined();
    storage['branilist.auth'] = { accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 };
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await logout();
    expect(storage['branilist.auth']).toBeUndefined();
  });
  it('retries 401 with rotated token and exactly the same tracking body/key', async () => {
    storage['branilist.auth'] = { accessToken: 'old', refreshToken: 'refresh', expiresAt: Date.now() + 3600000 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ matched: true, action: 'UNCHANGED' }));
    vi.stubGlobal('fetch', fetchMock);
    await syncProgress({ id: 'stable', occurredAt: '2026-09-26T05:00:00Z', state: { status: 'resolved', updatedAt: '' },
      media: { kind: 'ANIME', providerId: 'crunchyroll', providerMediaId: 'G123', title: 'Example', episode: 3, progressPercent: 90, canonicalUrl: 'https://www.crunchyroll.com/watch/G123' } });
    const first = fetchMock.mock.calls[0][1]; const retry = fetchMock.mock.calls[2][1];
    expect(first.body).toBe(retry.body);
    expect(first.headers.get('Idempotency-Key')).toBe(retry.headers.get('Idempotency-Key'));
    expect(retry.headers.get('authorization')).toBe('Bearer new');
    expect(storage['branilist.auth']).toMatchObject({ refreshToken: 'rotated' });
  });
});
