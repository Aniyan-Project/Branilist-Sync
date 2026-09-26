import type { TrackerProvider } from '../core/types';

export const comikeyProvider: TrackerProvider = {
  id: 'comikey',
  name: 'Comikey',
  hosts: ['comikey.com', 'www.comikey.com'],
  kind: 'MANGA',

  matches(url) {
    return this.hosts.includes(url.hostname);
  },

  async detect() {
    // Provider intencionalmente desativado até termos fixtures/seletores confiáveis.
    return null;
  },
};
