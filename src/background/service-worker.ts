import { authStatus, login, logout } from '../core/auth';
import { getLibrary, getMe, getMediaDetail, resolveMedia, saveUserMapping, syncProgress, updateLibrary } from '../core/api';
import { SyncEngine, type SyncSnapshot } from '../core/sync-engine';
import { trustedPopup, validateDetection } from '../core/message-policy';
import { loadSettings, saveSettings } from '../core/settings';
import type { DetectedMedia, EpisodeNavigationState, ExtensionMessage } from '../core/types';

const KEY = 'branilist.sync.v4';
const DETECTED = 'branilist.detected';
const NAVIGATION = 'branilist.episode-navigation';
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
    if (message.type === 'EPISODE_NAVIGATED') {
      const payload = message.payload as EpisodeNavigationState;
      const senderUrl = sender.url ? new URL(sender.url) : null;
      if (
        payload.providerId !== 'crunchyroll' ||
        !/^[A-Z0-9]{4,32}$/i.test(payload.episodeProviderId) ||
        !senderUrl ||
        !['www.crunchyroll.com', 'crunchyroll.com'].includes(senderUrl.hostname) ||
        !senderUrl.pathname.includes('/watch/' + payload.episodeProviderId)
      ) throw new Error('Mudança de episódio inválida.');
      await chrome.storage.local.set({ [NAVIGATION]: payload });
      return { ok: true, settings: await loadSettings() };
    }
    if (message.type === 'TRACKER_DETECTED' || message.type === 'SYNC_PROGRESS') {
      const media = validateDetection(message.payload, sender);
      await chrome.storage.local.set({ [DETECTED]: media });
      await chrome.storage.local.remove([NAVIGATION]);
      if (message.type === 'TRACKER_DETECTED') {
        const [status, settings] = await Promise.all([authStatus(), loadSettings()]);
        if (!status.authenticated) return { ok: true, authenticated: false, settings };
        try {
          return { ok: true, authenticated: true, settings, result: await resolveMedia(media) };
        } catch {
          return { ok: true, authenticated: true, settings, resolveError: true };
        }
      }
      const settings = await loadSettings();
      if (!settings.autoSync) return { ok: true, skipped: true, reason: 'auto_sync_disabled' };
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
    if (message.type === 'SETTINGS_GET') return { ok: true, settings: await loadSettings() };
    if (!trustedPopup(sender)) throw new Error('Ação permitida somente no popup.');
    if (message.type === 'SETTINGS_SET') return { ok: true, settings: await saveSettings(message.payload) };
    if (message.type === 'AUTH_LOGIN') {
      await login();
      await chrome.storage.local.remove([KEY, DETECTED, NAVIGATION]);
      return { ok: true };
    }
    if (message.type === 'AUTH_LOGOUT') {
      await logout();
      await chrome.storage.local.remove([KEY, DETECTED, NAVIGATION]);
      return { ok: true };
    }
    if (message.type === 'SYNC_RETRY') return { ok: true, lastSync: await engine.run(undefined, message.retryId) };
    if (message.type === 'LIBRARY_GET') return { ok: true, ...(await getLibrary()) };
    if (message.type === 'LIBRARY_UPDATE') {
      if (!Number.isSafeInteger(message.mediaId) || message.mediaId < 1) throw new Error('Mídia Branilist inválida.');
      await updateLibrary(message.mediaId, message.payload);
      return { ok: true };
    }
    if (message.type === 'MEDIA_GET') {
      if (!Number.isSafeInteger(message.mediaId) || message.mediaId < 1) throw new Error('Mídia Branilist inválida.');
      return { ok: true, media: await getMediaDetail(message.mediaId) };
    }
    if (message.type === 'AUTH_STATUS') {
      const status = await authStatus();
      let profile = null;
      let profileError: string | undefined;
      if (status.authenticated) {
        try { profile = await getMe(); }
        catch { profileError = 'Não foi possível consultar a conta. Verifique a conexão ou vincule novamente.'; }
      }
      const snapshot = await engine.snapshot();
      const settings = await loadSettings();
      return { ok: true, ...await authStatus(), profile, profileError, settings,
        oauth: { clientId: 'branilist-sync', extensionId: chrome.runtime.id, redirectUri: chrome.identity.getRedirectURL('oauth2') },
        lastDetected: (await chrome.storage.local.get(DETECTED))[DETECTED] as DetectedMedia | undefined,
        episodeNavigation: (await chrome.storage.local.get(NAVIGATION))[NAVIGATION] as EpisodeNavigationState | undefined,
        pending: snapshot.events.filter(event => ['resolved', 'error', 'confirmation_required'].includes(event.state.status)).map(event => event.state),
        history: snapshot.events.slice(-20).reverse().map(event => ({ ...event.state, occurredAt: event.occurredAt })),
        lastSync: snapshot.lastSync };
    }
    throw new Error('Ação desconhecida.');
  };
  const result = queue.then(task);
  queue = result.catch(() => undefined);
  void result.then(sendResponse, () => sendResponse({ ok: false, error: 'Não foi possível concluir a ação. Verifique a conexão e tente novamente.' }));
  return true;
});
