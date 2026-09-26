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
    // Netflix detection is network-driven by the dedicated MAIN/ISOLATED bridge.
    // Keep the registry entry for provider discovery and future DOM fallback work.
    return null;
  },
};
