import type { TrackerProvider } from './types';
import { crunchyrollProvider } from '../providers/crunchyroll';
import { netflixProvider } from '../providers/netflix';
import { comikeyProvider } from '../providers/comikey';

export const providers: readonly TrackerProvider[] = [
  crunchyrollProvider,
  netflixProvider,
  comikeyProvider,
];

export function providerForUrl(url: URL): TrackerProvider | undefined {
  return providers.find((provider) => provider.matches(url));
}

export function providerForHost(url: URL): TrackerProvider | undefined {
  return providers.find((provider) => provider.hosts.includes(url.hostname));
}

export function providerById(id: string): TrackerProvider | undefined {
  return providers.find((provider) => provider.id === id);
}
