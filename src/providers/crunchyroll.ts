import type { TrackerProvider } from '../core/types';

export const crunchyrollProvider: TrackerProvider = {
  id: 'crunchyroll',
  name: 'Crunchyroll',
  hosts: ['www.crunchyroll.com', 'crunchyroll.com'],
  kind: 'ANIME',

  matches(url) {
    return this.hosts.includes(url.hostname) && /\/watch\//.test(url.pathname);
  },

  async detect({ url, document }) {
    // TODO(provider): estabilizar seletores com fixtures reais antes de marcar como suportado.
    const title = document.querySelector('h1')?.textContent?.trim();
    if (!title) return null;

    return {
      providerId: this.id,
      kind: 'ANIME',
      title,
      canonicalUrl: url.href,
    };
  },
};
