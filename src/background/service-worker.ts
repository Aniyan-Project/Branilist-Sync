import { authStatus, login, logout } from '../core/auth';
import { getMe, resolveMedia, syncProgress } from '../core/api';
import { shouldTrackProgress } from '../core/tracking';
import type { BranilistProfile, DetectedMedia, ExtensionMessage, SyncState } from '../core/types';

const lastEvent = new Map<string, number>();
let lastDetected: DetectedMedia | null = null;
let lastSync: SyncState = { status: 'idle', updatedAt: new Date().toISOString() };

function dedupeKey(payload: { providerId: string; canonicalUrl: string; episode?: number; chapter?: number }) {
  return `${payload.providerId}:${payload.canonicalUrl}:${payload.episode ?? ''}:${payload.chapter ?? ''}`;
}

function setSync(state: Omit<SyncState, 'updatedAt'>) {
  lastSync = { ...state, updatedAt: new Date().toISOString() };
}

async function profileIfAuthenticated(): Promise<BranilistProfile | null> {
  const status = await authStatus();
  if (!status.authenticated) return null;
  try {
    return await getMe();
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'AUTH_LOGIN') {
        await login();
        sendResponse({ ok: true, profile: await profileIfAuthenticated() });
        return;
      }

      if (message.type === 'AUTH_LOGOUT') {
        await logout();
        setSync({ status: 'idle', message: 'Conta desvinculada.' });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'AUTH_STATUS') {
        const status = await authStatus();
        sendResponse({
          ok: true,
          ...status,
          profile: status.authenticated ? await profileIfAuthenticated() : null,
          lastDetected,
          lastSync,
        });
        return;
      }

      if (message.type === 'TRACKER_DETECTED') {
        lastDetected = message.payload;
        setSync({ status: 'detected', media: message.payload, message: 'Mídia detectada.' });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'SYNC_PROGRESS') {
        lastDetected = message.payload;

        if (!shouldTrackProgress(message.payload)) {
          setSync({ status: 'ignored', media: message.payload, message: 'Progresso abaixo do limite seguro.' });
          sendResponse({ ok: true, ignored: true });
          return;
        }

        const key = dedupeKey(message.payload);
        const previous = lastEvent.get(key) ?? 0;
        if (Date.now() - previous < 15_000) {
          sendResponse({ ok: true, deduped: true });
          return;
        }
        lastEvent.set(key, Date.now());

        const resolution = await resolveMedia(message.payload);
        if (!resolution.matched || resolution.requiresConfirmation) {
          setSync({
            status: 'confirmation_required',
            media: message.payload,
            result: resolution,
            message: resolution.reason ?? 'O Branilist precisa confirmar a correspondência antes de atualizar sua lista.',
          });
          sendResponse({ ok: true, requiresConfirmation: true, result: resolution });
          return;
        }

        setSync({ status: 'resolved', media: message.payload, result: resolution, message: 'Correspondência segura encontrada.' });

        const result = await syncProgress(message.payload);
        if (result.requiresConfirmation) {
          setSync({
            status: 'confirmation_required',
            media: message.payload,
            result,
            message: result.reason ?? 'O evento requer confirmação manual.',
          });
          sendResponse({ ok: true, requiresConfirmation: true, result });
          return;
        }

        setSync({
          status: 'synced',
          media: message.payload,
          result,
          message: result.action === 'PROGRESS_UPDATED'
            ? `Progresso atualizado para ${result.newProgress}.`
            : 'Lista já estava atualizada.',
        });
        sendResponse({ ok: true, result });
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      setSync({ status: 'error', media: lastDetected ?? undefined, message: messageText });
      sendResponse({ ok: false, error: messageText });
    }
  })();

  return true;
});
