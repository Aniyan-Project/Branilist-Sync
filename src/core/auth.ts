const AUTH_BASE = 'https://branilist.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://branilist.com/oauth/token';
const CLIENT_ID = 'BRANILIST_CHROME_EXTENSION_CLIENT_ID';
const STORAGE_KEY = 'branilist.auth';

interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
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

export async function login(): Promise<void> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = await sha256(verifier);
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const redirectUri = chrome.identity.getRedirectURL('oauth2');

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

  const callback = new URL(result);
  if (callback.searchParams.get('state') !== state) throw new Error('OAuth state inválido');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error(callback.searchParams.get('error') ?? 'Código OAuth ausente');

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error(`Falha ao trocar OAuth code: ${response.status}`);

  const token = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const auth: StoredAuth = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: auth });
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

export async function logout(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function authStatus(): Promise<{ authenticated: boolean }> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { authenticated: Boolean(result[STORAGE_KEY]?.accessToken) };
}

export async function accessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY]?.accessToken ?? null;
}
