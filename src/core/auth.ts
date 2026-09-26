import { CLIENT_ID, callbackCode, validateRedirect } from './oauth-policy';
const AUTH_BASE = 'https://branilist.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://branilist.com/oauth/token';
const REVOKE_ENDPOINT = 'https://branilist.com/oauth/revoke';
const STORAGE_KEY = 'branilist.auth';
const EXPIRY_SKEW_MS = 30_000;

interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(hash));
}

async function loadAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StoredAuth | undefined) ?? null;
}

async function saveAuth(token: TokenResponse, previousRefreshToken?: string): Promise<void> {
  if (!token.access_token || typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0 ||
    (token.refresh_token !== undefined && (typeof token.refresh_token !== 'string' || !token.refresh_token))) throw new Error('Resposta OAuth inválida.');
  const auth: StoredAuth = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previousRefreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
  };

  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.local.set({ [STORAGE_KEY]: auth });
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) await chrome.storage.local.remove(STORAGE_KEY);
    throw new Error(`Falha OAuth: ${response.status}`);
  }

  return (await response.json()) as TokenResponse;
}

export async function login(): Promise<void> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = await sha256(verifier);
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  validateRedirect(redirectUri, chrome.runtime.id);

  const authUrl = new URL(AUTH_BASE);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'profile list:read list:write');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  const result = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  if (!result) throw new Error('OAuth cancelado');

  const code = callbackCode(result, redirectUri, state);

  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  );

  await saveAuth(token);
}

export async function refreshAccessToken(force = false): Promise<string | null> {
  const auth = await loadAuth();
  if (!auth) return null;

  if (!force && auth.expiresAt > Date.now() + EXPIRY_SKEW_MS) {
    return auth.accessToken;
  }

  if (!auth.refreshToken) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return null;
  }

  try {
    const token = await tokenRequest(
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: auth.refreshToken,
      }),
    );
    await saveAuth(token, auth.refreshToken);
    return token.access_token;
  } catch (error) {
    throw error;
  }
}

async function revoke(raw?: string): Promise<void> {
  if (!raw) return;
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: raw }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
  } catch {
    // Logout local deve continuar mesmo se a rede estiver indisponível.
  }
}

export async function logout(): Promise<void> {
  const auth = await loadAuth();
  try {
    await revoke(auth?.refreshToken);
    await revoke(auth?.accessToken);
  } finally {
    await chrome.storage.local.remove(STORAGE_KEY);
  }
}

export async function authStatus(): Promise<{ authenticated: boolean }> {
  const auth = await loadAuth();
  return { authenticated: Boolean(auth?.accessToken || auth?.refreshToken) };
}

export async function accessToken(): Promise<string | null> {
  return refreshAccessToken(false);
}
