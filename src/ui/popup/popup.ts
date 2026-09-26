import type {
  BranilistProfile,
  CrunchyrollBridgeDiagnostics,
  CurrentResolution,
  DetectedMedia,
  EpisodeNavigationState,
  ExtensionSettings,
  LibraryEntry,
  LibraryStatus,
  MediaDetail,
  MediaTitleLanguage,
  SyncState,
} from '../../core/types';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const accountSummary = $('#account-summary');
const accountEl = $('#account');
const profileButton = $('#profile-button');
const authButton = $('#auth') as HTMLButtonElement;
const openButton = $('#open') as HTMLButtonElement;
const refreshButton = $('#refresh') as HTMLButtonElement;
const oauthEl = $('#oauth');
const bridgeDiagnosticsEl = $('#bridge-diagnostics');

const currentMediaEl = $('#current-media');
const currentMediaTitleEl = $('#current-media-title');
const currentMediaDetailEl = $('#current-media-detail');
const currentEmptyEl = $('#current-empty');
const currentMatchEl = $('#current-match');
const currentCover = $('#current-cover') as HTMLImageElement;
const currentBranilistTitle = $('#current-branilist-title');
const currentBranilistMeta = $('#current-branilist-meta');
const currentOpen = $('#current-open') as HTMLButtonElement;
const currentOpenFallback = $('#current-open-fallback') as HTMLButtonElement;
const currentProgress = $('#current-progress');
const currentList = $('#current-list');
const currentStatus = $('#current-status') as HTMLSelectElement;
const currentScore = $('#current-score') as HTMLInputElement;
const currentPlus = $('#current-plus') as HTMLButtonElement;
const currentSave = $('#current-save') as HTMLButtonElement;
const currentFeedback = $('#current-feedback');
const currentFlow = $('#current-flow');

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
const pendingCandidatesEl = $('#pending-candidates');
const retryButton = $('#retry') as HTMLButtonElement;

const librarySearch = $('#library-search') as HTMLInputElement;
const libraryStatus = $('#library-status') as HTMLSelectElement;
const libraryType = $('#library-type') as HTMLSelectElement;
const librarySort = $('#library-sort') as HTMLSelectElement;
const libraryList = $('#library-list');
const libraryEmpty = $('#library-empty');
const libraryState = $('#library-state');
const libraryBrowser = $('#library-browser');
const libraryDetail = $('#library-detail');
const detailBack = $('#detail-back') as HTMLButtonElement;
const detailPlus = $('#detail-plus') as HTMLButtonElement;
const detailHero = $('#detail-hero');
const detailDescription = $('#detail-description');
const detailForm = $('#detail-form') as HTMLFormElement;
const detailStatus = $('#detail-status') as HTMLSelectElement;
const detailProgress = $('#detail-progress') as HTMLInputElement;
const detailScore = $('#detail-score') as HTMLInputElement;
const detailRepeat = $('#detail-repeat') as HTMLInputElement;
const detailSave = $('#detail-save') as HTMLButtonElement;
const detailFeedback = $('#detail-feedback');

const historyList = $('#history-list');
const historyEmpty = $('#history-empty');
const settingAutoSync = $('#setting-auto-sync') as HTMLInputElement;
const settingShowToast = $('#setting-show-toast') as HTMLInputElement;
const settingToastDuration = $('#setting-toast-duration') as HTMLInputElement;
const settingQuickStart = $('#setting-quick-start') as HTMLInputElement;
const settingsFeedback = $('#settings-feedback');

let authenticated = false;
let profile: BranilistProfile | null = null;
let retryId: string | undefined;
let pending: SyncState[] = [];
let library: LibraryEntry[] = [];
let libraryLoaded = false;
let selectedEntry: LibraryEntry | null = null;
let currentMatchedMedia: MediaDetail | null = null;
let currentEntry: LibraryEntry | null = null;
let episodeNavigation: EpisodeNavigationState | null = null;
let history: Array<SyncState & { occurredAt?: string }> = [];
let settings: ExtensionSettings = {
  autoSync: true,
  showToast: true,
  toastDurationSeconds: 30,
  quickPlusStartsCurrent: true,
};

const statusLabels: Record<LibraryStatus, string> = {
  PLANNING: 'Planejando',
  CURRENT: 'Assistindo/Lendo',
  COMPLETED: 'Completo',
  PAUSED: 'Pausado',
  DROPPED: 'Abandonado',
};

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

function totalFor(entry: LibraryEntry): number | null {
  return entry.media.type === 'ANIME' ? entry.media.episodes ?? null : entry.media.chapters ?? null;
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

function mediaUrl(media: Pick<MediaDetail, 'type' | 'slug'>): string {
  return `https://branilist.com/${media.type.toLowerCase()}/${encodeURIComponent(media.slug)}`;
}

function setLibraryState(message = '', error = false) {
  libraryState.textContent = message;
  libraryState.classList.toggle('error', error);
}

function setDetailFeedback(message = '', error = false) {
  detailFeedback.textContent = message;
  detailFeedback.classList.toggle('error', error);
}

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(profile?.localeCode ?? 'pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function renderSettings() {
  settingAutoSync.checked = settings.autoSync;
  settingShowToast.checked = settings.showToast;
  settingToastDuration.value = String(settings.toastDurationSeconds);
  settingQuickStart.checked = settings.quickPlusStartsCurrent;
  settingToastDuration.disabled = !settings.showToast;
}

function renderHistory() {
  historyList.replaceChildren();
  historyEmpty.hidden = history.length > 0;
  for (const item of history) {
    const row = document.createElement('div');
    row.className = 'history-item';
    const head = document.createElement('div');
    head.className = 'history-head';
    const title = document.createElement('strong');
    title.textContent = item.media?.title ?? 'Sincronização Branilist';
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = formatTime(item.occurredAt ?? item.updatedAt);
    head.append(title, time);
    const status = document.createElement('div');
    status.className = 'history-status';
    const label = item.status === 'synced' ? 'Sincronizado'
      : item.status === 'error' ? 'Erro'
      : item.status === 'confirmation_required' ? 'Revisão necessária'
      : item.status === 'ignored' ? 'Ignorado'
      : item.status === 'resolved' ? 'Correspondência encontrada'
      : 'Detectado';
    const progress = item.result?.newProgress ? ' • progresso ' + item.result.newProgress : '';
    status.textContent = label + progress + (item.message ? ' • ' + item.message : '');
    row.append(head, status);
    historyList.append(row);
  }
}

function renderCurrentFlow(
  media: DetectedMedia | null,
  currentResolution?: CurrentResolution | null,
  lastSync?: SyncState | null,
) {
  currentFlow.replaceChildren();
  if (!media) return;

  const resolutionMatches = currentResolution?.media?.canonicalUrl === media.canonicalUrl;
  const syncMatches = lastSync?.media?.canonicalUrl === media.canonicalUrl;

  const steps = [
    { label: 'Detectado', done: true },
    {
      label: 'Correspondência',
      done: Boolean(resolutionMatches && currentResolution?.result?.matched && !currentResolution.result.requiresConfirmation),
      warn: Boolean(resolutionMatches && currentResolution?.result?.requiresConfirmation),
    },
    { label: 'Sincronizado', done: Boolean(syncMatches && lastSync?.status === 'synced') },
  ];

  for (const step of steps) {
    const el = document.createElement('span');
    el.className = 'sync-step' + (step.done ? ' done' : step.warn ? ' warn' : '');
    el.textContent = step.label;
    currentFlow.append(el);
  }

  const timestamp = syncMatches ? lastSync?.updatedAt : resolutionMatches ? currentResolution?.resolvedAt : undefined;
  if (timestamp) {
    const time = document.createElement('span');
    time.className = 'sync-step';
    time.textContent = formatTime(timestamp);
    currentFlow.append(time);
  }
}

function renderCurrentEntry(entry: LibraryEntry | null) {
  currentEntry = entry;
  currentList.hidden = !entry;
  const fallback = document.querySelector<HTMLElement>('#current-actions-fallback');
  if (fallback) fallback.hidden = Boolean(entry);
  if (!entry) {
    currentProgress.textContent = 'Ainda não foi possível carregar sua entrada da lista.';
    return;
  }
  const total = totalFor(entry);
  currentProgress.textContent = total
    ? entry.progress + ' / ' + total + ' • ' + statusLabels[entry.status]
    : entry.progress + ' • ' + statusLabels[entry.status];
  currentStatus.value = entry.status;
  currentScore.value = entry.score ? String(entry.score) : '';
  currentPlus.textContent = entry.media.type === 'ANIME' ? '+1 episódio' : '+1 capítulo';
  currentPlus.disabled = total !== null && entry.progress >= total;
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

function renderEpisodeNavigation(nav: EpisodeNavigationState | null, media: DetectedMedia | null) {
  episodeNavigation = nav;
  if (!nav || nav.episodeProviderId === media?.providerEpisodeId) return false;

  currentMatchEl.hidden = true;
  currentMatchedMedia = null;
  currentEntry = null;
  currentList.hidden = true;
  currentMediaEl.hidden = false;
  currentEmptyEl.hidden = true;
  currentMediaTitleEl.textContent = 'Mudança de episódio detectada';
  currentMediaDetailEl.textContent = `crunchyroll • episódio ${nav.episodeProviderId} • aguardando metadados do novo episódio…`;
  currentFlow.replaceChildren();

  const detectedStep = document.createElement('span');
  detectedStep.className = 'sync-step done';
  detectedStep.textContent = 'Mudança detectada';
  const waitingStep = document.createElement('span');
  waitingStep.className = 'sync-step warn';
  waitingStep.textContent = 'Aguardando metadados';
  currentFlow.append(detectedStep, waitingStep);
  return true;
}

function renderCurrentMedia(media: DetectedMedia | null) {
  currentMatchEl.hidden = true;
  currentMatchedMedia = null;
  currentEntry = null;
  currentList.hidden = true;
  currentFlow.replaceChildren();
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

async function hydrateCurrentMatch(media: DetectedMedia | null, currentResolution?: CurrentResolution | null) {
  currentMatchEl.hidden = true;
  currentMatchedMedia = null;
  const result = currentResolution?.result;
  if (!media || !result?.matched || result.requiresConfirmation || !result.mediaId) return;
  if (currentResolution?.media?.canonicalUrl !== media.canonicalUrl) return;

  const response = await chrome.runtime.sendMessage({ type: 'MEDIA_GET', mediaId: result.mediaId });
  if (!response?.ok || !response.media) return;

  const detail = response.media as MediaDetail;
  currentMatchedMedia = detail;
  currentCover.removeAttribute('src');
  if (detail.coverImage) currentCover.src = detail.coverImage;
  currentBranilistTitle.textContent = titleFor(detail.title, profile?.titleLanguage, profile?.localeCode);
  const total = detail.type === 'ANIME' ? detail.episodes : detail.chapters;
  currentBranilistMeta.textContent = [
    'Correspondência segura',
    detail.format,
    detail.seasonYear,
    total ? `${total} ${detail.type === 'ANIME' ? 'eps.' : 'caps.'}` : null,
  ].filter(Boolean).join(' • ');
  currentMatchEl.hidden = false;

  if (authenticated && !libraryLoaded) await loadLibrary();
  renderCurrentEntry(library.find(entry => entry.mediaId === detail.id) ?? null);
}

async function hydratePendingCandidates(state: SyncState | null) {
  pendingCandidatesEl.replaceChildren();
  const ids = state?.status === 'confirmation_required' ? state.result?.candidates ?? [] : [];
  if (!ids.length) return;

  const details = await Promise.all(ids.slice(0, 6).map(async mediaId => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'MEDIA_GET', mediaId });
      return response?.ok ? response.media as MediaDetail : null;
    } catch {
      return null;
    }
  }));

  if (retryId !== state?.retryId) return;
  for (const media of details.filter(Boolean) as MediaDetail[]) {
    const item = document.createElement('div');
    item.className = 'candidate';
    const image = document.createElement('img');
    image.alt = '';
    if (media.coverImage) image.src = media.coverImage;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = titleFor(media.title, profile?.titleLanguage, profile?.localeCode);
    const meta = document.createElement('small');
    meta.textContent = [media.format, media.seasonYear, 'Branilist #' + media.id].filter(Boolean).join(' • ');
    copy.append(title, meta);
    item.append(image, copy);
    pendingCandidatesEl.append(item);
  }
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
      ? 'Encontramos ' + candidates.length + ' candidato(s) para revisão.'
      : 'A correspondência precisa de revisão.'
    : '';
  void hydratePendingCandidates(state);
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

function sortedLibrary(): LibraryEntry[] {
  const query = librarySearch.value.trim().toLowerCase();
  const status = libraryStatus.value;
  const type = libraryType.value;

  const filtered = library.filter(entry => {
    const title = titleFor(entry.media.title, profile?.titleLanguage, profile?.localeCode).toLowerCase();
    return (!query || title.includes(query))
      && (!status || entry.status === status)
      && (!type || entry.media.type === type);
  });

  return filtered.sort((a, b) => {
    switch (librarySort.value) {
      case 'TITLE_ASC':
        return titleFor(a.media.title, profile?.titleLanguage, profile?.localeCode)
          .localeCompare(titleFor(b.media.title, profile?.titleLanguage, profile?.localeCode), profile?.localeCode ?? 'pt-BR');
      case 'PROGRESS_DESC':
        return b.progress - a.progress;
      case 'SCORE_DESC':
        return (b.score ?? -1) - (a.score ?? -1);
      default:
        return Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? '');
    }
  });
}

async function updateEntry(entry: LibraryEntry, progress: number, status = entry.status) {
  const payload = {
    status,
    progress,
    score: entry.score ?? null,
    repeatCount: entry.repeatCount,
  };
  const response = await chrome.runtime.sendMessage({ type: 'LIBRARY_UPDATE', mediaId: entry.mediaId, payload });
  if (!response?.ok) throw new Error(response?.error ?? 'Não foi possível atualizar a lista.');
  entry.status = status;
  entry.progress = progress;
  entry.updatedAt = new Date().toISOString();
}

async function incrementEntry(entry: LibraryEntry, button?: HTMLButtonElement) {
  const total = totalFor(entry);
  const next = entry.progress + 1;
  if (total !== null && next > total) return;
  if (button) button.disabled = true;
  try {
    const nextStatus: LibraryStatus = settings.quickPlusStartsCurrent && entry.status === 'PLANNING' ? 'CURRENT' : entry.status;
    await updateEntry(entry, next, nextStatus);
    renderLibrary();
    if (currentEntry?.mediaId === entry.mediaId) {
      renderCurrentEntry(entry);
      currentFeedback.textContent = 'Progresso atualizado.';
      currentFeedback.classList.remove('error');
    }
    if (selectedEntry?.mediaId === entry.mediaId) {
      detailStatus.value = entry.status;
      detailProgress.value = String(entry.progress);
      detailPlus.disabled = total !== null && entry.progress >= total;
      setDetailFeedback('Progresso atualizado.');
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function renderLibrary() {
  const filtered = sortedLibrary();
  libraryList.replaceChildren();
  libraryEmpty.hidden = filtered.length > 0;

  for (const entry of filtered) {
    const row = document.createElement('div');
    row.className = 'library-row';

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
    const total = totalFor(entry);
    progress.textContent = total
      ? `${entry.progress} / ${total} • ${statusLabels[entry.status]}`
      : `${entry.progress} • ${statusLabels[entry.status]}`;
    copy.append(strong, progress);

    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = entry.score ? entry.score.toFixed(1) : '—';

    button.append(img, copy, score);
    button.addEventListener('click', () => void openDetail(entry));

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'quick-plus';
    plus.textContent = '+1';
    plus.title = entry.media.type === 'ANIME' ? 'Adicionar 1 episódio' : 'Adicionar 1 capítulo';
    plus.disabled = total !== null && entry.progress >= total;
    plus.addEventListener('click', () => void incrementEntry(entry, plus).catch(showError));

    row.append(button, plus);
    libraryList.append(row);
  }

  if (libraryLoaded) {
    setLibraryState(`${filtered.length} de ${library.length} obras`);
  }
}

async function loadLibrary(force = false) {
  if (!authenticated) {
    setLibraryState('Vincule sua conta para acessar sua lista.', true);
    return;
  }
  if (libraryLoaded && !force) return;
  setLibraryState('Carregando sua lista…');

  const response = await chrome.runtime.sendMessage({ type: 'LIBRARY_GET' });
  if (!response?.ok) {
    setLibraryState(response?.error ?? 'Não foi possível carregar sua lista.', true);
    return;
  }

  library = response.items ?? [];
  libraryLoaded = true;
  renderLibrary();
}

async function openDetail(entry: LibraryEntry) {
  selectedEntry = entry;
  libraryBrowser.hidden = true;
  libraryDetail.classList.add('active');
  setDetailFeedback('Carregando detalhes…');
  detailHero.replaceChildren();
  detailDescription.textContent = '';

  const response = await chrome.runtime.sendMessage({ type: 'MEDIA_GET', mediaId: entry.mediaId });
  if (!response?.ok) {
    setDetailFeedback(response?.error ?? 'Não foi possível carregar os detalhes.', true);
    return;
  }

  const media = response.media as MediaDetail;
  renderDetailHero(entry, media);
  detailDescription.textContent = media.description?.trim() || 'Sem descrição disponível.';

  detailStatus.value = entry.status;
  detailProgress.value = String(entry.progress);
  const total = media.type === 'ANIME' ? media.episodes : media.chapters;
  detailProgress.max = total == null ? '' : String(total);
  detailScore.value = entry.score ? String(entry.score) : '';
  detailRepeat.value = String(entry.repeatCount);
  detailPlus.textContent = media.type === 'ANIME' ? '+1 episódio' : '+1 capítulo';
  detailPlus.disabled = total !== null && total !== undefined && entry.progress >= total;
  setDetailFeedback();
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

  const extensionVersion = chrome.runtime.getManifest?.().version ?? 'dev';
  accountSummary.textContent = `${label} • v${extensionVersion}`;
  accountEl.textContent = response.profileError ? `${label} • ${response.profileError}` : label;
  profileButton.textContent = profile?.username?.slice(0, 1).toUpperCase() || 'B';
  authButton.textContent = authenticated ? 'Desvincular conta' : 'Vincular conta';

  oauthEl.textContent = response.oauth
    ? `Client: ${response.oauth.clientId}\nID: ${response.oauth.extensionId}\nCallback: ${response.oauth.redirectUri}`
    : '';

  const bridge = (response.bridgeDiagnostics ?? null) as CrunchyrollBridgeDiagnostics | null;
  bridgeDiagnosticsEl.textContent = bridge
    ? [
        `Bridge: ${bridge.active ? 'ATIVO' : 'inativo'}`,
        `JSONs observados: ${bridge.jsonResponsesSeen ?? 0}`,
        bridge.startedAt ? `Iniciado: ${formatTime(bridge.startedAt)}` : null,
        bridge.lastRequestAt ? `Última resposta: ${formatTime(bridge.lastRequestAt)}` : null,
        bridge.lastRequestUrl ? `Última URL: ${bridge.lastRequestUrl}` : null,
        bridge.lastEpisodeId ? `Último episódio extraído: ${bridge.lastEpisodeId}${bridge.lastEpisodeNumber ? ` (E${bridge.lastEpisodeNumber})` : ''}` : 'Último episódio extraído: nenhum',
        bridge.lastEpisodeAt ? `Extraído em: ${formatTime(bridge.lastEpisodeAt)}` : null,
      ].filter(Boolean).join('\n')
    : 'Bridge: sem sinal recebido ainda.';

  settings = response.settings ?? settings;
  history = response.history ?? [];
  renderSettings();
  renderHistory();

  const detected = (response.lastDetected ?? null) as DetectedMedia | null;
  const currentResolution = (response.currentResolution ?? null) as CurrentResolution | null;
  const lastSync = (response.lastSync ?? null) as SyncState | null;
  const navigation = (response.episodeNavigation ?? null) as EpisodeNavigationState | null;
  const waitingForNewEpisode = renderEpisodeNavigation(navigation, detected);
  if (!waitingForNewEpisode) {
    renderCurrentMedia(detected);
    renderCurrentFlow(detected, currentResolution, lastSync);
    await hydrateCurrentMatch(detected, currentResolution);
  }

  pending = response.pending ?? [];
  renderPendingList(lastSync);

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

async function persistSettings() {
  const duration = Number(settingToastDuration.value);
  const payload: ExtensionSettings = {
    autoSync: settingAutoSync.checked,
    showToast: settingShowToast.checked,
    toastDurationSeconds: Number.isFinite(duration) ? duration : 30,
    quickPlusStartsCurrent: settingQuickStart.checked,
  };
  settingsFeedback.textContent = 'Salvando…';
  settingsFeedback.classList.remove('error');
  const response = await chrome.runtime.sendMessage({ type: 'SETTINGS_SET', payload });
  if (!response?.ok) {
    settingsFeedback.textContent = response?.error ?? 'Não foi possível salvar as configurações.';
    settingsFeedback.classList.add('error');
    return;
  }
  settings = response.settings ?? payload;
  renderSettings();
  settingsFeedback.textContent = 'Configurações salvas.';
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach(button => {
  button.addEventListener('click', () => activateTab(button.dataset.tab ?? 'current'));
});

profileButton.addEventListener('click', () => activateTab('settings'));
librarySearch.addEventListener('input', renderLibrary);
libraryStatus.addEventListener('change', renderLibrary);
libraryType.addEventListener('change', renderLibrary);
librarySort.addEventListener('change', renderLibrary);
for (const control of [settingAutoSync, settingShowToast, settingToastDuration, settingQuickStart]) {
  control.addEventListener('change', () => void persistSettings());
}

currentOpen.addEventListener('click', () => {
  if (currentMatchedMedia) void chrome.tabs.create({ url: mediaUrl(currentMatchedMedia) });
});
currentOpenFallback.addEventListener('click', () => {
  if (currentMatchedMedia) void chrome.tabs.create({ url: mediaUrl(currentMatchedMedia) });
});
currentPlus.addEventListener('click', () => {
  if (!currentEntry) return;
  void incrementEntry(currentEntry, currentPlus).catch(error => {
    currentFeedback.textContent = error instanceof Error ? error.message : 'Falha ao atualizar progresso.';
    currentFeedback.classList.add('error');
  });
});
currentSave.addEventListener('click', () => void busy(currentSave, async () => {
  if (!currentEntry) return;
  const scoreText = currentScore.value.trim();
  const score = scoreText ? Number(scoreText) : null;
  if (score !== null && (score < 0.5 || score > 10 || (score * 2) % 1 !== 0)) {
    currentFeedback.textContent = 'A nota deve ficar entre 0.5 e 10 em passos de 0.5.';
    currentFeedback.classList.add('error');
    return;
  }
  const response = await chrome.runtime.sendMessage({
    type: 'LIBRARY_UPDATE',
    mediaId: currentEntry.mediaId,
    payload: {
      status: currentStatus.value as LibraryStatus,
      progress: currentEntry.progress,
      score,
      repeatCount: currentEntry.repeatCount,
    },
  });
  if (!response?.ok) throw new Error(response?.error ?? 'Não foi possível atualizar a lista.');
  currentEntry.status = currentStatus.value as LibraryStatus;
  currentEntry.score = score;
  currentEntry.updatedAt = new Date().toISOString();
  renderCurrentEntry(currentEntry);
  renderLibrary();
  currentFeedback.textContent = 'Lista atualizada.';
  currentFeedback.classList.remove('error');
}));

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
  setDetailFeedback();
});

detailPlus.addEventListener('click', () => {
  if (selectedEntry) void incrementEntry(selectedEntry, detailPlus).catch(error => setDetailFeedback(error instanceof Error ? error.message : 'Falha ao atualizar progresso.', true));
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
      setDetailFeedback('Confira progresso, nota e repetições.', true);
      return;
    }

    const total = totalFor(selectedEntry);
    if (total !== null && payload.progress > total) {
      setDetailFeedback('O progresso não pode ultrapassar o total da obra.', true);
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
    selectedEntry.updatedAt = new Date().toISOString();
    detailPlus.disabled = total !== null && selectedEntry.progress >= total;
    renderLibrary();
    setDetailFeedback('Lista atualizada com sucesso.');
  }).catch(error => setDetailFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar a lista.', true));
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
