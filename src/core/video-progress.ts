export interface VideoProgressOptions {
  thresholdPercent?: number;
  onThreshold(percent: number): void;
}

export function observeVideoProgress(
  root: Document,
  options: VideoProgressOptions,
): () => void {
  const threshold = options.thresholdPercent ?? 90;
  let video: HTMLVideoElement | null = null;
  let completed = false;
  let detachVideo: (() => void) | null = null;

  const attach = (candidate: HTMLVideoElement) => {
    if (video === candidate) return;

    detachVideo?.();
    video = candidate;
    completed = false;

    const onProgress = () => {
      if (!video || completed || !Number.isFinite(video.duration) || video.duration <= 0) return;

      const percent = Math.max(0, Math.min(100, (video.currentTime / video.duration) * 100));
      if (percent < threshold) return;

      completed = true;
      options.onThreshold(Math.round(percent * 10) / 10);
    };

    video.addEventListener('timeupdate', onProgress);
    video.addEventListener('ended', onProgress);

    detachVideo = () => {
      candidate.removeEventListener('timeupdate', onProgress);
      candidate.removeEventListener('ended', onProgress);
    };
  };

  const discover = () => {
    const candidate = root.querySelector<HTMLVideoElement>('video');
    if (candidate) attach(candidate);
  };

  discover();

  const observer = new MutationObserver(discover);
  observer.observe(root.documentElement, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    detachVideo?.();
  };
}
