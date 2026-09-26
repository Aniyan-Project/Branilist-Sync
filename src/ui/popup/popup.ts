import type { BranilistProfile, DetectedMedia, SyncState } from '../../core/types';

const accountEl = document.querySelector<HTMLDivElement>('#account')!;
const authButton = document.querySelector<HTMLButtonElement>('#auth')!;
const openButton = document.querySelector<HTMLButtonElement>('#open')!;
const currentMediaEl = document.querySelector<HTMLDivElement>('#current-media')!;
const currentMediaTitleEl = document.querySelector<HTMLElement>('#current-media-title')!;
const currentMediaDetailEl = document.querySelector<HTMLDivElement>('#current-media-detail')!;
const currentEmptyEl = document.querySelector<HTMLElement>('#current-empty')!;
const pendingSectionEl = document.querySelector<HTMLElement>('#pending-section')!;
const pendingMediaEl = document.querySelector<HTMLDivElement>('#pending-media')!;
const pendingMediaTitleEl = document.querySelector<HTMLElement>('#pending-media-title')!;
const pendingMediaDetailEl = document.querySelector<HTMLDivElement>('#pending-media-detail')!;
const syncEl = document.querySelector<HTMLDivElement>('#sync')!;
const syncTitleEl = document.querySelector<HTMLElement>('#sync-title')!;
const syncMessageEl = document.querySelector<HTMLDivElement>('#sync-message')!;
const syncCandidatesEl = document.querySelector<HTMLDivElement>('#sync-candidates')!;

let authenticated = false;
let retryId: string | undefined;
let pending: SyncState[] = [];
const retryButton = document.querySelector<HTMLButtonElement>('#retry')!;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!;
const pendingSelect = document.querySelector<HTMLSelectElement>('#pending')!;
const oauthEl = document.querySelector<HTMLElement>('#oauth')!;

function mediaDetail(media: DetectedMedia): string {
  const progress = media.episode
    ? `Episódio ${media.episode}`
    : media.chapter
      ? `Capítulo ${media.chapter}`
      : 'Mídia detectada';

  const ids = [
    media.providerEpisodeId ? `episódio ${media.providerEpisodeId}` : null,
    media.providerSeasonId ? `temporada ${media.providerSeasonId}` : null,
    media.providerSeriesId ? `série ${media.providerSeriesId}` : null,
  ].filter(Boolean).join(' • ');

  return `${media.providerId} • ${progress}${ids ? ` • ${ids}` : ''}`;
}

function renderCurrentMedia(media: DetectedMedia | null) {
  if (!media) {
    currentMediaEl.style.display = 'none';
    currentEmptyEl.hidden = false;
    return;
  }

  currentMediaEl.style.display = 'block';
  currentEmptyEl.hidden = true;
  currentMediaTitleEl.textContent = media.title;
  currentMediaDetailEl.textContent = mediaDetail(media);
}

function renderPendingMedia(media: DetectedMedia | null) {
  if (!media) {
    pendingMediaEl.style.display = 'none';
    return;
  }

  pendingMediaEl.style.display = 'block';
  pendingMediaTitleEl.textContent = media.title;
  pendingMediaDetailEl.textContent = mediaDetail(media);
}

function renderSync(state: SyncState | null) {
  retryId = state?.retryId;
  retryButton.hidden = !authenticated || !retryId || !state || !['error', 'confirmation_required', 'resolved'].includes(state.status);
  retryButton.textContent = state?.status === 'confirmation_required' ? 'Verificar novamente' : 'Tentar novamente';

  if (!state || state.status === 'idle' || state.status === 'detected') {
    syncEl.style.display = 'none';
    return;
  }

  syncEl.style.display = 'block';
  syncEl.className = 'card';

  const titles: Record<SyncState['status'], string> = {
    idle: 'Aguardando',
    detected: 'Detectado',
    ignored: 'Ainda não sincronizado',
    resolved: 'Correspondência encontrada',
    confirmation_required: 'Confirmação necessária',
    synced: 'Sincronizado',
    error: 'Erro de sincronização',
  };

  syncTitleEl.textContent = titles[state.status];
  syncMessageEl.textContent = state.message ?? '';
  syncCandidatesEl.textContent = '';

  if (state.status === 'confirmation_required') {
    syncEl.classList.add('warning');
    const candidates = state.result?.candidates ?? [];
    syncCandidatesEl.textContent = candidates.length
      ? `Candidatos Branilist: ${candidates.join(', ')}. A correspondência precisa de revisão no Branilist.`
      : 'A correspondência precisa de revisão no Branilist.';
  } else if (state.status === 'synced') {
    syncEl.classList.add('success');
  } else if (state.status === 'error') {
    syncEl.classList.add('error');
  }
}

function renderPending(state: SyncState | null) {
  renderPendingMedia(state?.media ?? null);
  renderSync(state);
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
  if (!response?.ok) throw new Error(response?.error ?? 'Não foi possível consultar o estado.');

  authenticated = Boolean(response?.authenticated);
  const profile = (response?.profile ?? null) as BranilistProfile | null;

  accountEl.textContent = authenticated
    ? profile
      ? `Conectado como ${profile.displayName || profile.username} (@${profile.username})`
      : 'Conta Branilist vinculada.'
    : 'Nenhuma conta vinculada.';

  authButton.textContent = authenticated ? 'Desvincular conta' : 'Vincular conta';
  accountEl.className = response.profileError ? 'card error' : 'card';
  if (response.profileError) accountEl.textContent += ` ${response.profileError}`;

  oauthEl.textContent = response.oauth
    ? `Client: ${response.oauth.clientId}\nID: ${response.oauth.extensionId}\nCallback: ${response.oauth.redirectUri}`
    : '';

  renderCurrentMedia((response.lastDetected ?? null) as DetectedMedia | null);

  pending = response.pending ?? [];
  pendingSelect.replaceChildren();
  pending.forEach(state => {
    const option = document.createElement('option');
    option.value = state.retryId ?? '';
    option.textContent = `${state.media?.title ?? 'Episódio'} • ${state.media?.episode ?? ''}`;
    pendingSelect.append(option);
  });

  pendingSectionEl.hidden = pending.length === 0;

  if (!pending.length) {
    retryId = undefined;
    renderPending(null);
    return;
  }

  const selected = pending.find(state => state.retryId === retryId)
    ?? pending.find(state => state.retryId === response.lastSync?.retryId)
    ?? pending[0];

  if (selected?.retryId) pendingSelect.value = selected.retryId;
  renderPending(selected ?? null);
}

function showError(error: unknown) {
  accountEl.textContent = error instanceof Error ? error.message : 'Não foi possível consultar o estado.';
  accountEl.className = 'card error';
}

async function busy(action: () => Promise<void>) {
  for (const button of [authButton, retryButton, refreshButton]) button.disabled = true;
  pendingSelect.disabled = true;
  try { await action(); } catch (error) { showError(error); }
  finally {
    for (const button of [authButton, retryButton, refreshButton]) button.disabled = false;
    pendingSelect.disabled = false;
  }
}

pendingSelect.addEventListener('change', () => {
  const state = pending.find(item => item.retryId === pendingSelect.value);
  renderPending(state ?? null);
});

retryButton.addEventListener('click', () => void busy(async () => {
  if (!retryId) return;
  const response = await chrome.runtime.sendMessage({ type: 'SYNC_RETRY', retryId });
  if (!response?.ok) throw new Error(response?.error ?? 'Falha ao tentar novamente.');
  retryId = undefined;
  await refresh();
}));

refreshButton.addEventListener('click', () => void busy(refresh));

authButton.addEventListener('click', () => void busy(async () => {
  const response = await chrome.runtime.sendMessage({ type: authenticated ? 'AUTH_LOGOUT' : 'AUTH_LOGIN' });
  if (!response?.ok) throw new Error(response?.error ?? 'Falha desconhecida');
  retryId = undefined;
  await refresh();
}));

openButton.addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://branilist.com' });
});

void busy(refresh);
