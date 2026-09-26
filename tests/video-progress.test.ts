// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeVideoProgress } from '../src/core/video-progress';
let stop: (() => void) | undefined;
afterEach(() => { stop?.(); document.body.replaceChildren(); });
function video(duration = 100) {
  const element = document.createElement('video');
  Object.defineProperty(element, 'duration', { configurable: true, value: duration });
  document.body.append(element); return element;
}
async function tick(element: HTMLVideoElement, currentTime: number) {
  element.currentTime = currentTime; element.dispatchEvent(new Event('timeupdate')); await Promise.resolve(); await Promise.resolve();
}
describe('video lifecycle', () => {
  it('waits for 90%, emits once, and removes listeners', async () => {
    const element = video(); const onThreshold = vi.fn();
    stop = observeVideoProgress(document, { onThreshold });
    await tick(element, 89.9); expect(onThreshold).not.toHaveBeenCalled();
    await tick(element, 90); await tick(element, 100); expect(onThreshold).toHaveBeenCalledTimes(1);
    stop(); element.dispatchEvent(new Event('emptied')); await tick(element, 100);
    expect(onThreshold).toHaveBeenCalledTimes(1);
  });
  it.each([0, Infinity, NaN])('ignores invalid/live duration %s', async duration => {
    const element = video(duration); const onThreshold = vi.fn();
    stop = observeVideoProgress(document, { onThreshold });
    await tick(element, 100); expect(onThreshold).not.toHaveBeenCalled();
  });
  it('allows late metadata, reused video, and replacement nodes', async () => {
    const element = video(); const onThreshold = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    stop = observeVideoProgress(document, { onThreshold });
    await tick(element, 90); await tick(element, 91); expect(onThreshold).toHaveBeenCalledTimes(2);
    element.dispatchEvent(new Event('emptied')); await tick(element, 95); expect(onThreshold).toHaveBeenCalledTimes(3);
    element.remove(); const replacement = video(); await Promise.resolve();
    await tick(element, 99); await tick(replacement, 95); expect(onThreshold).toHaveBeenCalledTimes(4);
  });
});
