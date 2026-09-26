import type { BranilistProfile, DetectedMedia, SyncState } from '../../core/types';

const accountEl = document.querySelector<HTMLDivElement>('#account')!;
const authButton = document.querySelector<HTMLButtonElement>('#auth')!;
const openButton = document.querySelector<HTMLButtonElement>('#open')!;
const mediaEl = document.querySelector<HTMLDivElement>('#media')!;
const mediaTitleEl = document.querySelector<HTMLElement>('#media-title')!;
const mediaDetailEl = document.querySelector<HTMLDivElement>('#media-detail')!;
const syncEl = document.querySelector<HTMLDivElement>('#sync')!;
const syncTitleEl = document.querySelector<HTMLElement>('#sync-title')!;
const syncMessageEl = document.querySelector<HTMLDivElement>('#sync-message')!;
const syncCandidatesEl = document.querySelector<HTMLDivElement>('#sync-candidates')!;

let authenticated = false;

function renderMedia(media: DetectedMedia | null) {
  if (!media) {
    mediaEl.style.display = 'none';
    return;
  }

  mediaEl.style.display = 'block';
  mediaTitleEl.textContent = media.title;
  const progress = media.episode
    ? `Episódio ${media.episode}`
    : media.chapter
      ? `Capítulo ${media.chapter}`
      : 'Mídia detectada';
  mediaDetailEl.textContent = `${media.providerId} • ${progress}`;
}

function renderSync(state: SyncState | null) {
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
      ? `Candidatos Branilist: ${candidates.join(', ')}. Nenhuma alteração foi feita na sua lista.`
      : 'Nenhuma alteração foi feita na sua lista.';
  } else if (state.status === 'synced') {
    syncEl.classList.add('success');
  } else if (state.status === 'error') {
    syncEl.classList.add('error');
  }
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
  authenticated = Boolean(response?.authenticated);
  const profile = (response?.profile ?? null) as BranilistProfile | null;

  accountEl.textContent = authenticated
    ? profile
      ? `Conectado como ${profile.displayName || profile.username} (@${profile.username})`
      : 'Conta Branilist vinculada.'
    : 'Nenhuma conta vinculada.';

  authButton.textContent = authenticated ? 'Desvincular conta' : 'Vincular conta';
  renderMedia((response?.lastDetected ?? null) as DetectedMedia | null);
  renderSync((response?.lastSync ?? null) as SyncState | null);
}

authButton.addEventListener('click', async () => {
  authButton.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: authenticated ? 'AUTH_LOGOUT' : 'AUTH_LOGIN',
    });

    if (!response?.ok) throw new Error(response?.error ?? 'Falha desconhecida');
    await refresh();
  } catch (error) {
    accountEl.textContent = error instanceof Error ? error.message : String(error);
    accountEl.className = 'card error';
  } finally {
    authButton.disabled = false;
  }
});

openButton.addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://branilist.com' });
});

void refresh();
