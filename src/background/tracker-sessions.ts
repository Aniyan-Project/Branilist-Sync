import type {
  TrackerSessionState,
  TrackerSessionSummary,
} from '../core/types';

export type TrackerSessionMap = Record<string, TrackerSessionState>;

export function trackerSessionKey(tabId: number, frameId: number, providerId: string): string {
  return `${tabId}:${frameId}:${providerId}`;
}

export function trackerSessionIdentity(
  sender: chrome.runtime.MessageSender,
  providerId: string,
): { key: string; tabId: number; frameId: number; providerId: string } {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId;

  if (
    !Number.isSafeInteger(tabId) ||
    (tabId ?? -1) < 0 ||
    frameId !== 0 ||
    !providerId
  ) {
    throw new Error('Sessão de tracking inválida.');
  }

  return {
    key: trackerSessionKey(tabId!, frameId, providerId),
    tabId: tabId!,
    frameId,
    providerId,
  };
}

export function selectTrackerSession(
  sessions: TrackerSessionMap,
  activeTabId?: number,
): TrackerSessionState | undefined {
  const all = Object.values(sessions)
    .filter(session => session.frameId === 0)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  if (Number.isSafeInteger(activeTabId) && (activeTabId ?? -1) >= 0) {
    return all.find(session => session.tabId === activeTabId);
  }

  return all[0];
}

export function summarizeTrackerSession(session: TrackerSessionState): TrackerSessionSummary {
  return {
    key: session.key,
    tabId: session.tabId,
    frameId: session.frameId,
    providerId: session.providerId,
    updatedAt: session.updatedAt,
    active: session.providerDiagnostics?.active ?? Boolean(session.detected),
    title: session.detected?.title,
    episode: session.detected?.episode,
    canonicalUrl: session.detected?.canonicalUrl ?? session.providerDiagnostics?.lastCanonicalUrl,
  };
}
