import type {
  BranilistProfile,
  DetectedMedia,
  LibraryEntry,
  LibraryStatus,
  MediaDetail,
  MediaTitleLanguage,
  SyncState,
} from '../../core/types';

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;

const accountSummary = $('#account-summary');
const accountEl = $('#account');
const profileButton = $('#profile-button');
const authButton = $('#auth') as HTMLButtonElement;
const openButton = $('#open') as HTMLButtonElement;
const refreshButton = $('#refresh') as HTMLButtonElement;
const oauthEl = $('#oauth');

const currentMediaEl = $('#current-media');
const currentMediaTitleEl = $('#current-media-title');
const currentMediaDetailEl = $('#current-media-detail');
const currentEmptyEl = $('#current-empty');

const pendingContentEl = $('#pending-content');
const pendingEmptyEl = $('#pending-empty');
const pendingSelect = $('#pending') as HTMLSelectElement;
const pendingMediaEl = $('#pending-media');
const pendingMediaTitleEl = $('#pending-media-title');
const pendingMediaDetailEl = $('#pending-media-detail');
const syncEl = $('#sync');
const syncTitleEl = $('#sync-title');
const syncMessageEl = $('#sync-message');
const syncCandidatesEl = $('#sync-candidates');
const retryButton = $('#retry') as HTMLButtonElement;

const librarySearch = $('#library-search') as HTMLInputElement;
const libraryStatus = $('#library-status') as HTMLSelectElement;
const libraryList = $('#library-list');
const libraryEmpty = $('#library-empty');
const libraryError = $('#library-error');
const libraryBrowser = $('#library-browser');
const libraryDetail = $('#library-detail');
const detailBack = $('#detail-back') as HTMLButtonElement;
const detailHero = $('#detail-hero');
const detailDescription = $('#detail-description');
const detailForm = $('#detail-form') as HTMLFormElement;
const detailStatus = $('#detail-status') as HTMLSelectElement;
const detailProgress = $('#detail-progress') as HTMLInputElement;
const detailScore = $('#detail-score') as HTMLInputElement;
const detailRepeat = $('#detail-repeat') as HTMLInputElement;
const detailSave = $('#detail-save') as HTMLButtonElement;
const detailFeedback = $('#detail-feedback');

let authenticated = false;
let profile: BranilistProfile | null = null;
let retryId: string | undefined;
let pending: SyncState[] = [];
let library: LibraryEntry[] = [];
let libraryLoaded = false;
let selectedEntry: LibraryEntry | null = null;

function titleFor(
  titles: { romaji?: string | null; english?: string | null; portuguese?: string | null; native?: string | null },
  preference: MediaTitleLanguage = 'AUTO',
  localeCode = 'pt-BR',
): string {
  const order: Array<keyof typeof titles> = preference === 'PORTUGUESE'
    ? ['portuguese', 'romaji', 'english', 'native']
    : preference === 'ENGLISH'
      ? ['english', 'romaji', 'portuguese', 'native']
      : preference === 'ROMAJI'
        ? ['romaji', 'english', 'portuguese', 'native']
        : preference === 'NATIVE'
          ? ['native', 'romaji', 'english', 'portuguese']
          : localeCode.toLowerCase().startsWith('pt')
            ? ['portuguese', 'romaji', 'english', 'native']
            : ['romaji', 'english', 'native', 'portuguese'];

  for (const key of order) {
    const value = titles[key]?.trim();
    if (value) return value;
  }
  return 'Título indisponível';
}

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

function activateTab(name: string) {
  document.querySelectorAll<HTMLElement>('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });
  document.querySelectorAll<HTMLElement>('.view').forEach(view => {
    view.classList.toggle('active', view.dataset.view === name);
  });
  if (name === 'library' && authenticated && !libraryLoaded) void loadLibrary();
}

function renderCurrentMedia(media: DetectedMedia | null) {
  if (!media) {
    currentMediaEl.hidden = true;
    currentEmptyEl.hidden = false;
    return;
  }
  currentMediaEl.hidden = false;
  currentEmptyEl.hidden = true;
  currentMediaTitleEl.textContent = media.title;
  currentMediaDetailEl.textContent = mediaDetail(media);
}

function renderPending(state: SyncState | null) {
  retryId = state?.retryId;
  retryButton.hidden = !authenticated || !retryId || !state ||
    !['error', 'confirmation_required', 'resolved'].includes(state.status);
  retryButton.textContent = state?.status === 'confirmation_required'
    ? 'Verificar novamente'
    : 'Tentar novamente';

  if (!state) {
    pendingMediaEl.hidden = true;
    syncEl.hidden = true;
    return;
  }

  pendingMediaEl.hidden = !state.media;
  if (state.media) {
    pendingMediaTitleEl.textContent = state.media.title;
    pendingMediaDetailEl.textContent = mediaDetail(state.media);
  }

  syncEl.hidden = ['idle', 'detected'].includes(state.status);
  if (syncEl.hidden) return;

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
  const candidates = state.result?.candidates ?? [];
  syncCandidatesEl.textContent = state.status === 'confirmation_required'
    ? candidates.length
      ? `Candidatos Branilist: ${candidates.join(', ')}.`
      : 'A correspondência precisa de revisão.'
    : '';
}

function renderPendingList(lastSync?: SyncState | null) {
  pendingSelect.replaceChildren();
  pending.forEach(state => {
    const option = document.createElement('option');
    option.value = state.retryId ?? '';
    option.textContent = `${state.media?.title ?? 'Mídia'}${state.media?.episode ? ` • E${state.media.episode}` : ''}`;
    pendingSelect.append(option);
  });

  pendingEmptyEl.hidden = pending.length > 0;
  pendingContentEl.hidden = pending.length === 0;
  if (!pending.length) {
    retryId = undefined;
    renderPending(null);
    return;
  }

  const selected = pending.find(state => state.retryId === retryId)
    ?? pending.find(state => state.retryId === lastSync?.retryId)
    ?? pending[0];
  if (selected?.retryId) pendingSelect.value = selected.retryId;
  renderPending(selected ?? null);
}

function renderLibrary() {
  const query = librarySearch.value.trim().toLowerCase();
  const status = libraryStatus.value;

  const filtered = library.filter(entry => {
    const title = titleFor(entry.media.title, profile?.titleLanguage, profile?.localeCode).toLowerCase();
    return (!query || title.includes(query)) && (!status || entry.status === status);
  });

  libraryList.replaceChildren();
  libraryEmpty.hidden = filtered.length > 0;

  for (const entry of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-item';

    const img = document.createElement('img');
    img.className = 'cover';
    img.alt = '';
    if (entry.media.coverImage) img.src = entry.media.coverImage;

    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = titleFor(entry.media.title, profile?.titleLanguage, profile?.localeCode);
    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.textContent = entry.media.total
      ? `${entry.progress} / ${entry.media.total} • ${entry.status}`
      : `${entry.progress} • ${entry.status}`;
    copy.append(strong, progress);

    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = entry.score ? entry.score.toFixed(1) : '—';

    button.append(img, copy, score);
    button.addEventListener('click', () => void openDetail(entry));
    libraryList.append(button);
  }
}

async function loadLibrary(force = false) {
  if (!authenticated) {
    libraryError.textContent = 'Vincule sua conta para acessar sua lista.';
    return;
  }
  if (libraryLoaded && !force) return;
  libraryError.textContent = 'Carregando sua lista…';

  const response = await chrome.runtime.sendMessage({ type: 'LIBRARY_GET' });
  if (!response?.ok) {
    libraryError.textContent = response?.error ?? 'Não foi possível carregar sua lista.';
    return;
  }

  library = response.items ?? [];
  libraryLoaded = true;
  libraryError.textContent = '';
  renderLibrary();
}

async function openDetail(entry: LibraryEntry) {
  selectedEntry = entry;
  libraryBrowser.hidden = true;
  libraryDetail.classList.add('active');
  detailFeedback.textContent = 'Carregando detalhes…';
  detailHero.replaceChildren();
  detailDescription.textContent = '';

  const response = await chrome.runtime.sendMessage({ type: 'MEDIA_GET', mediaId: entry.mediaId });
  if (!response?.ok) {
    detailFeedback.textContent = response?.error ?? 'Não foi possível carregar os detalhes.';
    return;
  }

  const media = response.media as MediaDetail;
  renderDetailHero(entry, media);
  detailDescription.textContent = media.description?.trim() || 'Sem descrição disponível.';

  detailStatus.value = entry.status;
  detailProgress.value = String(entry.progress);
  detailProgress.max = String(media.type === 'ANIME' ? media.episodes ?? '' : media.chapters ?? '');
  detailScore.value = entry.score ? String(entry.score) : '';
  detailRepeat.value = String(entry.repeatCount);
  detailFeedback.textContent = '';
}

function renderDetailHero(entry: LibraryEntry, media: MediaDetail) {
  detailHero.replaceChildren();

  if (media.bannerImage) {
    const banner = document.createElement('img');
    banner.className = 'banner';
    banner.alt = '';
    banner.src = media.bannerImage;
    detailHero.append(banner);
  }

  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  const copy = document.createElement('div');
  copy.className = 'detail-copy';

  const cover = document.createElement('img');
  cover.className = 'detail-cover';
  cover.alt = '';
  if (media.coverImage || entry.media.coverImage) cover.src = media.coverImage || entry.media.coverImage || '';

  const meta = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = titleFor(media.title, profile?.titleLanguage, profile?.localeCode);
  const info = document.createElement('div');
  info.className = 'muted';
  const total = media.type === 'ANIME' ? media.episodes : media.chapters;
  info.textContent = [
    media.format,
    media.seasonYear,
    total ? `${total} ${media.type === 'ANIME' ? 'eps.' : 'caps.'}` : null,
    media.averageScore ? `média ${media.averageScore / 10}` : null,
  ].filter(Boolean).join(' • ');
  meta.append(title, info);
  copy.append(cover, meta);
  detailHero.append(overlay, copy);
}

async function refreshSession() {
  const response = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
  if (!response?.ok) throw new Error(response?.error ?? 'Não foi possível consultar o estado.');

  authenticated = Boolean(response.authenticated);
  profile = (response.profile ?? null) as BranilistProfile | null;

  const label = authenticated
    ? profile
      ? `${profile.displayName || profile.username} (@${profile.username})`
      : 'Conta Branilist vinculada'
    : 'Conta não vinculada';

  accountSummary.textContent = label;
  accountEl.textContent = response.profileError ? `${label} • ${response.profileError}` : label;
  profileButton.textContent = profile?.username?.slice(0, 1).toUpperCase() || 'B';
  authButton.textContent = authenticated ? 'Desvincular conta' : 'Vincular conta';

  oauthEl.textContent = response.oauth
    ? `Client: ${response.oauth.clientId}\nID: ${response.oauth.extensionId}\nCallback: ${response.oauth.redirectUri}`
    : '';

  renderCurrentMedia((response.lastDetected ?? null) as DetectedMedia | null);
  pending = response.pending ?? [];
  renderPendingList(response.lastSync ?? null);

  if (!authenticated) {
    library = [];
    libraryLoaded = false;
    renderLibrary();
  }
}

function showError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Não foi possível concluir a ação.';
  accountEl.textContent = message;
}

async function busy(button: HTMLButtonElement, action: () => Promise<void>) {
  button.disabled = true;
  try { await action(); } catch (error) { showError(error); }
  finally { button.disabled = false; }
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach(button => {
  button.addEventListener('click', () => activateTab(button.dataset.tab ?? 'current'));
});

profileButton.addEventListener('click', () => activateTab('settings'));
librarySearch.addEventListener('input', renderLibrary);
libraryStatus.addEventListener('change', renderLibrary);

pendingSelect.addEventListener('change', () => {
  const state = pending.find(item => item.retryId === pendingSelect.value);
  renderPending(state ?? null);
});

retryButton.addEventListener('click', () => void busy(retryButton, async () => {
  if (!retryId) return;
  const response = await chrome.runtime.sendMessage({ type: 'SYNC_RETRY', retryId });
  if (!response?.ok) throw new Error(response?.error ?? 'Falha ao tentar novamente.');
  retryId = undefined;
  await refreshSession();
}));

detailBack.addEventListener('click', () => {
  selectedEntry = null;
  libraryDetail.classList.remove('active');
  libraryBrowser.hidden = false;
  detailFeedback.textContent = '';
});

detailForm.addEventListener('submit', event => {
  event.preventDefault();
  void busy(detailSave, async () => {
    if (!selectedEntry) return;

    const scoreText = detailScore.value.trim();
    const payload = {
      status: detailStatus.value as LibraryStatus,
      progress: Number(detailProgress.value),
      score: scoreText ? Number(scoreText) : null,
      repeatCount: Number(detailRepeat.value),
    };

    if (!Number.isInteger(payload.progress) || payload.progress < 0 ||
        !Number.isInteger(payload.repeatCount) || payload.repeatCount < 0 ||
        (payload.score !== null && (payload.score < 0.5 || payload.score > 10 || (payload.score * 2) % 1 !== 0))) {
      detailFeedback.textContent = 'Confira progresso, nota e repetições.';
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'LIBRARY_UPDATE',
      mediaId: selectedEntry.mediaId,
      payload,
    });
    if (!response?.ok) throw new Error(response?.error ?? 'Não foi possível atualizar a lista.');

    selectedEntry.status = payload.status;
    selectedEntry.progress = payload.progress;
    selectedEntry.score = payload.score;
    selectedEntry.repeatCount = payload.repeatCount;
    renderLibrary();
    detailFeedback.textContent = 'Lista atualizada.';
  });
});

refreshButton.addEventListener('click', () => void busy(refreshButton, async () => {
  libraryLoaded = false;
  await refreshSession();
  if (document.querySelector('.tab.active')?.getAttribute('data-tab') === 'library') await loadLibrary(true);
}));

authButton.addEventListener('click', () => void busy(authButton, async () => {
  const response = await chrome.runtime.sendMessage({ type: authenticated ? 'AUTH_LOGOUT' : 'AUTH_LOGIN' });
  if (!response?.ok) throw new Error(response?.error ?? 'Falha desconhecida.');
  libraryLoaded = false;
  retryId = undefined;
  await refreshSession();
}));

openButton.addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://branilist.com' });
});

void refreshSession().catch(showError);
