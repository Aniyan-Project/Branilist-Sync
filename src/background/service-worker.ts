import { authStatus, login, logout } from '../core/auth';
import { syncProgress } from '../core/api';
import type { DetectedMedia, ExtensionMessage } from '../core/types';

const lastEvent = new Map<string, number>();
let lastDetected: DetectedMedia | null = null;

function dedupeKey(payload: { providerId: string; canonicalUrl: string; episode?: number; chapter?: number }) {
  return `${payload.providerId}:${payload.canonicalUrl}:${payload.episode ?? ''}:${payload.chapter ?? ''}`;
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'AUTH_LOGIN') {
        await login();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'AUTH_LOGOUT') {
        await logout();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'AUTH_STATUS') {
        sendResponse({ ok: true, ...(await authStatus()), lastDetected });
        return;
      }

      if (message.type === 'TRACKER_DETECTED') {
        lastDetected = message.payload;
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'SYNC_PROGRESS') {
        if ((message.payload.progressPercent ?? 0) < 80) {
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
        lastDetected = message.payload;
        await syncProgress(message.payload);
        sendResponse({ ok: true });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
});
