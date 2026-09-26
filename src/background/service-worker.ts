import { authStatus, login, logout } from '../core/auth';
import { getLibrary, getMe, getMediaDetail, resolveMedia, saveUserMapping, syncProgress, updateLibrary } from '../core/api';
import { SyncEngine, type SyncSnapshot } from '../core/sync-engine';
import { trustedPopup, validateDetection } from '../core/message-policy';
import { loadSettings, saveSettings } from '../core/settings';
import { providerById } from '../core/provider-registry';
import { crunchyrollLegacyMappingIds } from '../providers/crunchyroll/identity';
import {
  selectTrackerSession,
  summarizeTrackerSession,
  trackerSessionIdentity,
  type TrackerSessionMap,
} from './tracker-sessions';
import type {
  CrunchyrollBridgeDiagnostics,
  CurrentResolution,
  DetectedMedia,
  EpisodeNavigationState,
  ExtensionMessage,
  NetflixBridgeDiagnostics,
  ProviderDiagnostics,
  TrackerSessionState,
} from '../core/types';

const KEY = 'branilist.sync.v4';
const SESSIONS = 'branilist.tracker-sessions.v1';
const LEGACY_SESSION_KEYS = [
  'branilist.detected',
  'branilist.episode-navigation',
  'branilist.crunchyroll-bridge-diagnostics',
  'branilist.netflix-bridge-diagnostics',
  'branilist.provider-diagnostics',
  'branilist.current-resolution',
];
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.local.remove(LEGACY_SESSION_KEYS);
})();
const engine = new SyncEngine({
  load: async () => (await chrome.storage.local.get(KEY))[KEY] as SyncSnapshot | undefined,
  save: async snapshot => { await chrome.storage.local.set({ [KEY]: snapshot }); },
  resolve: resolveMedia,
  write: syncProgress,
});
// Account changes and writes must not race. Persisted events belong to this account.
let queue: Promise<unknown> = ready;

async function loadTrackerSessions(): Promise<TrackerSessionMap> {
  const stored = (await chrome.storage.local.get(SESSIONS))[SESSIONS];
  return stored && typeof stored === 'object' && !Array.isArray(stored)
    ? stored as TrackerSessionMap
    : {};
}

async function saveTrackerSessions(sessions: TrackerSessionMap): Promise<void> {
  await chrome.storage.local.set({ [SESSIONS]: sessions });
}

async function updateTrackerSession(
  sender: chrome.runtime.MessageSender,
  providerId: string,
  mutate: (session: TrackerSessionState) => TrackerSessionState,
): Promise<TrackerSessionState> {
  const identity = trackerSessionIdentity(sender, providerId);
  const sessions = await loadTrackerSessions();
  const previous: TrackerSessionState = sessions[identity.key] ?? {
    ...identity,
    updatedAt: new Date().toISOString(),
  };
  const next = mutate({ ...previous });
  const normalized: TrackerSessionState = {
    ...next,
    ...identity,
    updatedAt: new Date().toISOString(),
  };
  sessions[identity.key] = normalized;
  await saveTrackerSessions(sessions);
  return normalized;
}

function clearSessionCurrentState(session: TrackerSessionState): TrackerSessionState {
  const next = { ...session };
  delete next.detected;
  delete next.currentResolution;
  delete next.episodeNavigation;
  return next;
}

async function removeTrackerSessionsForTab(tabId: number): Promise<void> {
  const sessions = await loadTrackerSessions();
  let changed = false;
  for (const [key, session] of Object.entries(sessions)) {
    if (session.tabId !== tabId) continue;
    delete sessions[key];
    changed = true;
  }
  if (changed) await saveTrackerSessions(sessions);
}

function trustedMappingResult(result: Awaited<ReturnType<typeof resolveMedia>>): boolean {
  return result.matched === true &&
    result.requiresConfirmation === false &&
    result.action === 'MATCHED' &&
    Number.isSafeInteger(result.mediaId) &&
    (result.mediaId ?? 0) > 0 &&
    result.confidence === 1;
}

async function resolveWithLegacyMigration(media: DetectedMedia) {
  let result = await resolveMedia(media);
  if (trustedMappingResult(result) || media.providerId !== 'crunchyroll') return result;

  for (const legacyId of crunchyrollLegacyMappingIds(media)) {
    const legacy = await resolveMedia({ ...media, providerMediaId: legacyId });
    if (!trustedMappingResult(legacy)) continue;

    await saveUserMapping(media, legacy.mediaId!);
    result = legacy;
    break;
  }
  return result;
}
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const task = async () => {
    await ready;
    if (!message || typeof message.type !== 'string') throw new Error('Mensagem inválida.');
    if (message.type === 'PROVIDER_DIAGNOSTIC') {
      const payload = message.payload;
      const provider = providerById(payload.providerId);
      const senderUrl = sender.url ? new URL(sender.url) : null;
      const currentUrl = new URL(payload.canonicalUrl);
      const safeTitle = typeof payload.playerTitleText === 'string'
        ? payload.playerTitleText.trim().slice(0, 300)
        : undefined;

      if (
        sender.id !== chrome.runtime.id ||
        !sender.tab ||
        sender.frameId !== 0 ||
        !provider ||
        !senderUrl ||
        senderUrl.protocol !== 'https:' ||
        !provider.hosts.includes(senderUrl.hostname) ||
        currentUrl.protocol !== 'https:' ||
        currentUrl.origin !== senderUrl.origin ||
        !provider.hosts.includes(currentUrl.hostname) ||
        currentUrl.pathname !== payload.pathname ||
        typeof payload.active !== 'boolean' ||
        typeof payload.hasVideo !== 'boolean' ||
        typeof payload.hasPlayerRoot !== 'boolean' ||
        typeof payload.hasTitleRoot !== 'boolean' ||
        typeof payload.hasWatchId !== 'boolean'
      ) throw new Error('Diagnóstico de provider inválido.');

      await updateTrackerSession(sender, payload.providerId, session => {
        const previous = session.providerDiagnostics;
        const providerDiagnostics: ProviderDiagnostics = {
          ...(previous?.providerId === payload.providerId ? previous : { providerId: payload.providerId }),
          providerId: payload.providerId,
          active: payload.active,
          lastProbeAt: new Date().toISOString(),
          lastClearedAt: payload.active ? undefined : previous?.lastClearedAt,
          lastCanonicalUrl: `${currentUrl.origin}${currentUrl.pathname}`,
          lastPathname: payload.pathname.slice(0, 500),
          hasVideo: payload.hasVideo,
          hasPlayerRoot: payload.hasPlayerRoot,
          hasTitleRoot: payload.hasTitleRoot,
          hasWatchId: payload.hasWatchId,
          playerTitleText: safeTitle,
        };
        return { ...session, providerDiagnostics };
      });
      return { ok: true };
    }
    if (message.type === 'TRACKER_CLEARED') {
      const senderUrl = sender.url ? new URL(sender.url) : null;
      const currentUrl = new URL(message.payload.canonicalUrl);
      const provider = providerById(message.payload.providerId);
      if (
        !provider ||
        !senderUrl ||
        !provider.hosts.includes(senderUrl.hostname) ||
        currentUrl.origin !== senderUrl.origin ||
        !provider.hosts.includes(currentUrl.hostname) ||
        provider.matches(currentUrl)
      ) throw new Error('Limpeza de página inválida.');
      const previous = (await chrome.storage.local.get(PROVIDER_DIAG))[PROVIDER_DIAG] as ProviderDiagnostics | undefined;
      const providerDiagnostics: ProviderDiagnostics = {
        ...(previous?.providerId === message.payload.providerId ? previous : { providerId: message.payload.providerId }),
        providerId: message.payload.providerId,
        active: false,
        lastClearedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ [PROVIDER_DIAG]: providerDiagnostics });
      await chrome.storage.local.remove([DETECTED, NAVIGATION, CURRENT_RESOLUTION]);
      return { ok: true };
    }
    if (message.type === 'NETFLIX_WATCH_CHANGED') {
      const senderUrl = sender.url ? new URL(sender.url) : null;
      const currentUrl = new URL(message.payload.canonicalUrl);
      if (
        sender.id !== chrome.runtime.id ||
        !sender.tab ||
        sender.frameId !== 0 ||
        !senderUrl ||
        !['www.netflix.com', 'netflix.com'].includes(senderUrl.hostname) ||
        currentUrl.origin !== senderUrl.origin ||
        !['www.netflix.com', 'netflix.com'].includes(currentUrl.hostname) ||
        !/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/\d{4,20}(?:\/|$)/i.test(currentUrl.pathname) ||
        !/^\d{4,20}$/.test(message.payload.watchId) ||
        !currentUrl.pathname.includes('/watch/' + message.payload.watchId)
      ) throw new Error('Mudança de título Netflix inválida.');

      const previous = (await chrome.storage.local.get(PROVIDER_DIAG))[PROVIDER_DIAG] as ProviderDiagnostics | undefined;
      const providerDiagnostics: ProviderDiagnostics = {
        ...(previous?.providerId === 'netflix' ? previous : { providerId: 'netflix' }),
        providerId: 'netflix',
        active: true,
        lastProbeAt: new Date().toISOString(),
        lastCanonicalUrl: `${currentUrl.origin}${currentUrl.pathname}`,
        lastPathname: currentUrl.pathname,
        lastEpisodeId: undefined,
        lastEpisodeNumber: undefined,
        lastProgressPercent: undefined,
      };

      await chrome.storage.local.set({ [PROVIDER_DIAG]: providerDiagnostics });
      await chrome.storage.local.remove([DETECTED, NAVIGATION, CURRENT_RESOLUTION]);
      return { ok: true };
    }
    if (message.type === 'NETFLIX_BRIDGE_DIAGNOSTIC') {
      const senderUrl = sender.url ? new URL(sender.url) : null;
      if (
        sender.id !== chrome.runtime.id ||
        !sender.tab ||
        sender.frameId !== 0 ||
        !senderUrl ||
        !['www.netflix.com', 'netflix.com'].includes(senderUrl.hostname)
      ) throw new Error('Diagnóstico Netflix inválido.');

      const previous = ((await chrome.storage.local.get(NETFLIX_BRIDGE_DIAG))[NETFLIX_BRIDGE_DIAG] ?? {}) as NetflixBridgeDiagnostics;
      const payload = message.payload;
      const safeGenreIds = Array.isArray(payload.genreIds)
        ? [...new Set(payload.genreIds
            .map(value => Number(value))
            .filter(value => Number.isSafeInteger(value) && value > 0 && value <= 999999999))]
            .slice(0, 100)
        : previous.genreIds;
      const safeGenreStatus = typeof payload.genreStatus === 'number' && Number.isInteger(payload.genreStatus)
        ? payload.genreStatus
        : typeof payload.genreStatus === 'string'
          ? payload.genreStatus.slice(0, 80)
          : previous.genreStatus;
      const safeGenreLabels = Array.isArray(payload.genreLabels)
        ? payload.genreLabels
            .filter(value => typeof value === 'string')
            .map(value => value.trim().slice(0, 200))
            .filter(Boolean)
            .slice(0, 50)
        : previous.genreLabels;
      const safeGenreSource = payload.genreSource === 'ids' || payload.genreSource === 'labels' || payload.genreSource === 'none'
        ? payload.genreSource
        : previous.genreSource;
      const safeGenreFetchMode = payload.genreFetchMode === 'public'
        ? payload.genreFetchMode
        : previous.genreFetchMode;
      const next: NetflixBridgeDiagnostics = {
        ...previous,
        ...payload,
        active: true,
        memberApiHost: typeof payload.memberApiHost === 'string'
          ? payload.memberApiHost.slice(0, 300)
          : previous.memberApiHost,
        movieId: typeof payload.movieId === 'string' && /^\d{4,20}$/.test(payload.movieId)
          ? payload.movieId
          : previous.movieId,
        lastEpisodeId: typeof payload.lastEpisodeId === 'string' && /^\d{4,20}$/.test(payload.lastEpisodeId)
          ? payload.lastEpisodeId
          : previous.lastEpisodeId,
        lastSeriesId: typeof payload.lastSeriesId === 'string' && /^\d{4,20}$/.test(payload.lastSeriesId)
          ? payload.lastSeriesId
          : previous.lastSeriesId,
        genreStatus: safeGenreStatus,
        genreIds: safeGenreIds,
        genreLabels: safeGenreLabels,
        genreSource: safeGenreSource,
        genreFetchMode: safeGenreFetchMode,
        animeConfirmed: typeof payload.animeConfirmed === 'boolean'
          ? payload.animeConfirmed
          : previous.animeConfirmed,
      };
      await chrome.storage.local.set({ [NETFLIX_BRIDGE_DIAG]: next });
      return { ok: true };
    }
    if (message.type === 'BRIDGE_DIAGNOSTIC') {
      const senderUrl = sender.url ? new URL(sender.url) : null;
      if (!senderUrl || !['www.crunchyroll.com', 'crunchyroll.com'].includes(senderUrl.hostname)) throw new Error('Diagnóstico inválido.');
      const previous = ((await chrome.storage.local.get(BRIDGE_DIAG))[BRIDGE_DIAG] ?? {}) as CrunchyrollBridgeDiagnostics;
      const next = { ...previous, ...message.payload, active: true } as CrunchyrollBridgeDiagnostics;
      await chrome.storage.local.set({ [BRIDGE_DIAG]: next });
      return { ok: true };
    }
    if (message.type === 'EPISODE_NAVIGATED') {
      const payload = message.payload as EpisodeNavigationState;
      const senderUrl = sender.url ? new URL(sender.url) : null;
      const currentUrl = new URL(payload.canonicalUrl);
      if (
        payload.providerId !== 'crunchyroll' ||
        !/^[A-Z0-9]{4,32}$/i.test(payload.episodeProviderId) ||
        !senderUrl ||
        !['www.crunchyroll.com', 'crunchyroll.com'].includes(senderUrl.hostname) ||
        currentUrl.origin !== senderUrl.origin ||
        !currentUrl.pathname.includes('/watch/' + payload.episodeProviderId)
      ) throw new Error('Mudança de episódio inválida.');
      await chrome.storage.local.set({ [NAVIGATION]: payload });
      return { ok: true, settings: await loadSettings() };
    }
    if (message.type === 'TRACKER_DETECTED' || message.type === 'SYNC_PROGRESS') {
      const media = validateDetection(message.payload, sender);
      const previousDiagnostics = (await chrome.storage.local.get(PROVIDER_DIAG))[PROVIDER_DIAG] as ProviderDiagnostics | undefined;
      const providerDiagnostics: ProviderDiagnostics = {
        ...(previousDiagnostics?.providerId === media.providerId ? previousDiagnostics : { providerId: media.providerId }),
        providerId: media.providerId,
        active: true,
        lastClearedAt: undefined,
        lastDetectedAt: new Date().toISOString(),
        lastCanonicalUrl: media.canonicalUrl,
        lastEpisodeId: media.providerEpisodeId,
        lastEpisodeNumber: media.episode,
        lastProgressPercent: media.progressPercent,
      };
      await chrome.storage.local.set({ [DETECTED]: media, [PROVIDER_DIAG]: providerDiagnostics });
      await chrome.storage.local.remove([NAVIGATION]);
      if (message.type === 'TRACKER_DETECTED') {
        const [status, settings] = await Promise.all([authStatus(), loadSettings()]);
        if (!status.authenticated) {
          await chrome.storage.local.remove([CURRENT_RESOLUTION]);
          return { ok: true, authenticated: false, settings };
        }
        try {
          const result = await resolveWithLegacyMigration(media);
          const currentResolution: CurrentResolution = {
            media,
            result,
            resolvedAt: new Date().toISOString(),
          };
          await chrome.storage.local.set({ [CURRENT_RESOLUTION]: currentResolution });
          return { ok: true, authenticated: true, settings, result };
        } catch {
          await chrome.storage.local.remove([CURRENT_RESOLUTION]);
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
      const currentResolution: CurrentResolution = {
        media,
        result,
        resolvedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ [DETECTED]: media, [CURRENT_RESOLUTION]: currentResolution });
      return { ok: true, result };
    }
    if (message.type === 'SETTINGS_GET') return { ok: true, settings: await loadSettings() };
    if (!trustedPopup(sender)) throw new Error('Ação permitida somente no popup.');
    if (message.type === 'SETTINGS_SET') return { ok: true, settings: await saveSettings(message.payload) };
    if (message.type === 'AUTH_LOGIN') {
      await login();
      await chrome.storage.local.remove([KEY, DETECTED, NAVIGATION, BRIDGE_DIAG, NETFLIX_BRIDGE_DIAG, PROVIDER_DIAG, CURRENT_RESOLUTION]);
      return { ok: true };
    }
    if (message.type === 'AUTH_LOGOUT') {
      await logout();
      await chrome.storage.local.remove([KEY, DETECTED, NAVIGATION, BRIDGE_DIAG, NETFLIX_BRIDGE_DIAG, PROVIDER_DIAG, CURRENT_RESOLUTION]);
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
        bridgeDiagnostics: (await chrome.storage.local.get(BRIDGE_DIAG))[BRIDGE_DIAG] as CrunchyrollBridgeDiagnostics | undefined,
        netflixBridgeDiagnostics: (await chrome.storage.local.get(NETFLIX_BRIDGE_DIAG))[NETFLIX_BRIDGE_DIAG] as NetflixBridgeDiagnostics | undefined,
        providerDiagnostics: (await chrome.storage.local.get(PROVIDER_DIAG))[PROVIDER_DIAG] as ProviderDiagnostics | undefined,
        currentResolution: (await chrome.storage.local.get(CURRENT_RESOLUTION))[CURRENT_RESOLUTION] as CurrentResolution | undefined,
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
