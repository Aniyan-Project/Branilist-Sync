export interface VideoProgressOptions {
  thresholdPercent?: number;
  onThreshold(percent: number): void | boolean | Promise<boolean>;
}

export function observeVideoProgress(
  root: Document,
  options: VideoProgressOptions,
): () => void {
  const threshold = options.thresholdPercent ?? 90;
  let video: HTMLVideoElement | null = null;
  let completed = false;
  let detachVideo: (() => void) | null = null;
  let generation = 0;

  const attach = (candidate: HTMLVideoElement) => {
    if (video === candidate) return;

    detachVideo?.();
    video = candidate;
    completed = false;
    generation++;

    let pending = false;
    const reset = () => { generation++; completed = false; };
    const onProgress = async () => {
      if (pending || video !== candidate || !candidate.isConnected) return;
      if (!video || completed || !Number.isFinite(video.duration) || video.duration <= 0) return;

      const percent = Math.max(0, Math.min(100, (video.currentTime / video.duration) * 100));
      if (percent < threshold) return;

      if (!Number.isFinite(percent)) return;
      pending = true;
      const observedGeneration = generation;
      try {
        const accepted = await options.onThreshold(Math.round(percent * 10) / 10) !== false;
        if (observedGeneration === generation) completed = accepted;
      } catch { /* Metadata or extension context unavailable; a later tick may retry. */ }
      finally { pending = false; }
    };

    video.addEventListener('timeupdate', onProgress);
    video.addEventListener('ended', onProgress);
    video.addEventListener('emptied', reset);
    video.addEventListener('loadedmetadata', reset);

    detachVideo = () => {
      candidate.removeEventListener('timeupdate', onProgress);
      candidate.removeEventListener('ended', onProgress);
      candidate.removeEventListener('emptied', reset);
      candidate.removeEventListener('loadedmetadata', reset);
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
    generation++;
    observer.disconnect();
    detachVideo?.();
  };
}
