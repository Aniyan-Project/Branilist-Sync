import { providerForUrl } from '../core/provider-registry';
import type { DetectedMedia } from '../core/types';

const provider = providerForUrl(new URL(location.href));

async function emit(media: DetectedMedia): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'TRACKER_DETECTED', payload: media });
}

if (provider) {
  void provider.detect({ url: new URL(location.href), document }).then((media) => {
    if (media) void emit(media);
  });

  provider.observe?.(
    { url: new URL(location.href), document },
    (media) => void emit(media),
  );
}
