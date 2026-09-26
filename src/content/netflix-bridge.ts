import { extractNetflixNetworkEpisode } from '../providers/netflix/network';
import {
  classifyNetflixGenreLabels,
  classifyNetflixGenres,
  extractNetflixGenreIdsFromTitleHtml,
  extractNetflixGenreLabelsFromTitleDocument,
} from '../providers/netflix/genres';

const EPISODE_EVENT = 'branilist-sync:netflix-network-episode';
const DIAG_EVENT = 'branilist-sync:netflix-network-diagnostic';
const WATCH_EVENT = 'branilist-sync:netflix-watch-changed';

let lastMovieId = '';
let lastEndpoint = '';
let lastEpisodeId = '';
let timer: number | undefined;
const genreCache = new Map<string, { isAnime: boolean; genreIds: number[] }>();
const genreRetryAt = new Map<string, number>();

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

async function confirmAnime(seriesId: string): Promise<{ isAnime: boolean; genreIds: number[] } | null> {
  const cached = genreCache.get(seriesId);
  if (cached) return cached;

  const now = Date.now();
  const retryAt = genreRetryAt.get(seriesId) ?? 0;
  if (retryAt > now) return null;

  genreRetryAt.set(seriesId, now + 15_000);

  try {
    const response = await fetch(`https://www.netflix.com/title/${encodeURIComponent(seriesId)}`, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': navigator.language || 'en-US',
      },
    });

    const finalUrl = new URL(response.url || `https://www.netflix.com/title/${seriesId}`);
    if (!response.ok || !['www.netflix.com', 'netflix.com'].includes(finalUrl.hostname)) {
      emitDiagnostic({
        genreStatus: response.status,
        genreCheckedAt: new Date().toISOString(),
        animeConfirmed: false,
      });
      return null;
    }

    const html = await response.text();
    const genreIds = extractNetflixGenreIdsFromTitleHtml(html);
    if (genreIds.length) {
      const classification = classifyNetflixGenres(genreIds);
      genreCache.set(seriesId, classification);

      emitDiagnostic({
        genreStatus: response.status,
        genreCheckedAt: new Date().toISOString(),
        genreIds,
        genreSource: 'ids',
        genreFetchMode: 'public',
        animeConfirmed: classification.isAnime,
      });

      return classification;
    }

    const document = new DOMParser().parseFromString(html, 'text/html');
    const genreLabels = extractNetflixGenreLabelsFromTitleDocument(document);
    if (genreLabels.length) {
      const classification = {
        genreIds: [],
        isAnime: classifyNetflixGenreLabels(genreLabels),
      };
      genreCache.set(seriesId, classification);

      emitDiagnostic({
        genreStatus: response.status,
        genreCheckedAt: new Date().toISOString(),
        genreLabels,
        genreSource: 'labels',
        genreFetchMode: 'public',
        animeConfirmed: classification.isAnime,
      });

      return classification;
    }

    emitDiagnostic({
      genreStatus: 'genres_not_found',
      genreCheckedAt: new Date().toISOString(),
      genreSource: 'none',
      genreFetchMode: 'public',
      animeConfirmed: false,
    });
    return null;
  } catch {
    emitDiagnostic({
      genreStatus: 'fetch_error',
      genreCheckedAt: new Date().toISOString(),
      animeConfirmed: false,
    });
    return null;
  }
}

async function probe() {
  const movieId = currentMovieId();
  const base = memberApiBase();

  if (movieId && movieId !== lastMovieId) {
    lastEpisodeId = '';
    window.dispatchEvent(new CustomEvent(WATCH_EVENT, {
      detail: JSON.stringify({
        watchId: movieId,
        canonicalUrl: `${location.origin}${location.pathname}`,
      }),
    }));
  }

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

    const classification = await confirmAnime(episode.seriesProviderId);
    if (!classification?.isAnime) return;

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
