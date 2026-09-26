import type { TrackerProvider } from '../core/types';

export const netflixProvider: TrackerProvider = {
  id: 'netflix',
  name: 'Netflix',
  hosts: ['www.netflix.com'],
  kind: 'ANIME',

  matches(url) {
    return this.hosts.includes(url.hostname) && /\/watch\//.test(url.pathname);
  },

  async detect() {
    // Provider intencionalmente desativado até termos fixtures/seletores confiáveis.
    return null;
  },
};
