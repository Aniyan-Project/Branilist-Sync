import type { TrackerProvider } from '../core/types';

export const templateProvider: TrackerProvider = {
  id: 'example',
  name: 'Example',
  hosts: ['example.com'],
  kind: 'ANIME',

  matches(url) {
    return this.hosts.includes(url.hostname);
  },

  async detect({ url, document }) {
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
