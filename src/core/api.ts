import { accessToken } from './auth';
import type { DetectedMedia } from './types';

const API_BASE = 'https://branilist.com/api/extension/v1';

export async function syncProgress(media: DetectedMedia): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error('Conta Branilist não vinculada');

  const response = await fetch(`${API_BASE}/tracking/events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      provider: media.providerId,
      providerMediaId: media.providerMediaId,
      mediaType: media.kind,
      title: media.title,
      episode: media.episode,
      chapter: media.chapter,
      progressPercent: media.progressPercent,
      sourceUrl: media.canonicalUrl,
      occurredAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Branilist tracking API retornou ${response.status}`);
  }
}
