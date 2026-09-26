import { extractNetflixNetworkEpisode } from '../providers/netflix/network';

const EPISODE_EVENT = 'branilist-sync:netflix-network-episode';
const DIAG_EVENT = 'branilist-sync:netflix-network-diagnostic';

let lastMovieId = '';
let lastEndpoint = '';
let lastEpisodeId = '';
let timer: number | undefined;

function emitDiagnostic(payload: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(DIAG_EVENT, {
    detail: JSON.stringify({
      active: true,
      ...payload,
    }),
  }));
}

function currentMovieId(): string | null {
  const direct = location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(\d{4,20})(?:\/|$)/i)?.[1];
  if (direct) return direct;

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) {
    try {
      return new URL(canonical, location.href).pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(\d{4,20})(?:\/|$)/i)?.[1] ?? null;
    } catch {
      // Ignore malformed page metadata.
    }
  }

  return null;
}

function memberApiBase(): string | null {
  const netflix = (window as Window & { netflix?: { reactContext?: unknown } }).netflix;
  const context = netflix?.reactContext as Record<string, any> | undefined;
  const data = context?.models?.services?.data?.memberapi;
  const hostname = typeof data?.hostname === 'string' ? data.hostname.trim().toLowerCase() : '';
  const path = Array.isArray(data?.path) && typeof data.path[0] === 'string' ? data.path[0].trim() : '';

  if (!hostname || (!hostname.endsWith('.netflix.com') && hostname !== 'netflix.com')) return null;
  if (!path.startsWith('/') || path.includes('..')) return null;
  return `https://${hostname}${path.replace(/\/$/, '')}`;
}

async function probe() {
  const movieId = currentMovieId();
  const base = memberApiBase();

  emitDiagnostic({
    hasReactContext: Boolean((window as any).netflix?.reactContext),
    hasMemberApi: Boolean(base),
    movieId: movieId ?? undefined,
    memberApiHost: base ? new URL(base).hostname : undefined,
    checkedAt: new Date().toISOString(),
  });

  if (!movieId || !base) return;

  const endpoint = `${base}/metadata?movieid=${encodeURIComponent(movieId)}`;
  if (movieId === lastMovieId && endpoint === lastEndpoint && lastEpisodeId) return;

  lastMovieId = movieId;
  lastEndpoint = endpoint;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      emitDiagnostic({ lastMetadataStatus: response.status, lastMetadataAt: new Date().toISOString() });
      return;
    }

    const payload = await response.json();
    const episode = extractNetflixNetworkEpisode(payload);
    emitDiagnostic({
      lastMetadataStatus: response.status,
      lastMetadataAt: new Date().toISOString(),
      metadataMatched: Boolean(episode),
      lastEpisodeId: episode?.episodeProviderId,
      lastEpisodeNumber: episode?.episode,
      lastSeasonNumber: episode?.season,
      lastSeriesId: episode?.seriesProviderId,
    });

    if (!episode) return;
    lastEpisodeId = episode.episodeProviderId;
    window.dispatchEvent(new CustomEvent(EPISODE_EVENT, {
      detail: JSON.stringify(episode),
    }));
  } catch {
    emitDiagnostic({
      lastMetadataStatus: 'fetch_error',
      lastMetadataAt: new Date().toISOString(),
    });
  }
}

emitDiagnostic({ startedAt: new Date().toISOString() });
void probe();

timer = window.setInterval(() => {
  void probe();
}, 1000);

window.addEventListener('pagehide', () => {
  if (timer !== undefined) window.clearInterval(timer);
}, { once: true });
