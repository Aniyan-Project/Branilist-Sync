import { authStatus, login, logout } from '../core/auth';
import { getMe, resolveMedia, saveUserMapping, syncProgress } from '../core/api';
import { SyncEngine, type SyncSnapshot } from '../core/sync-engine';
import { trustedPopup, validateDetection } from '../core/message-policy';
import type { DetectedMedia, ExtensionMessage } from '../core/types';

const KEY = 'branilist.sync.v4';
const DETECTED = 'branilist.detected';
const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
const engine = new SyncEngine({
  load: async () => (await chrome.storage.local.get(KEY))[KEY] as SyncSnapshot | undefined,
  save: async snapshot => { await chrome.storage.local.set({ [KEY]: snapshot }); },
  resolve: resolveMedia,
  write: syncProgress,
});
// Account changes and writes must not race. Persisted events belong to this account.
let queue: Promise<unknown> = ready;
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const task = async () => {
    await ready;
    if (!message || typeof message.type !== 'string') throw new Error('Mensagem inválida.');
    if (message.type === 'TRACKER_DETECTED' || message.type === 'SYNC_PROGRESS') {
      const media = validateDetection(message.payload, sender);
      await chrome.storage.local.set({ [DETECTED]: media });
      if (message.type === 'TRACKER_DETECTED') {
        const status = await authStatus();
        if (!status.authenticated) return { ok: true, authenticated: false };
        try {
          return { ok: true, authenticated: true, result: await resolveMedia(media) };
        } catch {
          return { ok: true, authenticated: true, resolveError: true };
        }
      }
      return { ok: true, lastSync: await engine.run(media) };
    }
    if (message.type === 'SAVE_USER_MAPPING') {
      const media = validateDetection(message.payload.media, sender);
      if (!Number.isSafeInteger(message.payload.mediaId) || message.payload.mediaId < 1) throw new Error('Mídia Branilist inválida.');
      await saveUserMapping(media, message.payload.mediaId);
      const result = await resolveMedia(media);
      await chrome.storage.local.set({ [DETECTED]: media });
      return { ok: true, result };
    }
    if (!trustedPopup(sender)) throw new Error('Ação permitida somente no popup.');
    if (message.type === 'AUTH_LOGIN') {
      await login();
      await chrome.storage.local.remove([KEY, DETECTED]);
      return { ok: true };
    }
    if (message.type === 'AUTH_LOGOUT') {
      await logout();
      await chrome.storage.local.remove([KEY, DETECTED]);
      return { ok: true };
    }
    if (message.type === 'SYNC_RETRY') return { ok: true, lastSync: await engine.run(undefined, message.retryId) };
    if (message.type === 'AUTH_STATUS') {
      const status = await authStatus();
      let profile = null;
      let profileError: string | undefined;
      if (status.authenticated) {
        try { profile = await getMe(); }
        catch { profileError = 'Não foi possível consultar a conta. Verifique a conexão ou vincule novamente.'; }
      }
      return { ok: true, ...await authStatus(), profile, profileError,
        oauth: { clientId: 'branilist-sync', extensionId: chrome.runtime.id, redirectUri: chrome.identity.getRedirectURL('oauth2') },
        lastDetected: (await chrome.storage.local.get(DETECTED))[DETECTED] as DetectedMedia | undefined,
        pending: (await engine.snapshot()).events.filter(event => ['resolved', 'error', 'confirmation_required'].includes(event.state.status)).map(event => event.state),
        lastSync: (await engine.snapshot()).lastSync };
    }
    throw new Error('Ação desconhecida.');
  };
  const result = queue.then(task);
  queue = result.catch(() => undefined);
  void result.then(sendResponse, () => sendResponse({ ok: false, error: 'Não foi possível concluir a ação. Verifique a conexão e tente novamente.' }));
  return true;
});
