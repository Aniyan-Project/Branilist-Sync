let invalidated = false;

export function runtimeContextAvailable(): boolean {
  try {
    return !invalidated &&
      typeof chrome !== 'undefined' &&
      typeof chrome.runtime?.sendMessage === 'function';
  } catch {
    return false;
  }
}

export async function sendRuntimeMessage<T = unknown>(message: unknown): Promise<T | undefined> {
  if (!runtimeContextAvailable()) return undefined;

  try {
    return await chrome.runtime.sendMessage(message) as T;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error ?? '');
    if (/extension context invalidated/i.test(text)) invalidated = true;

    // Content-script messaging is best-effort. Reloading/updating an unpacked
    // extension invalidates scripts already injected into open pages; swallowing
    // that rejection avoids a noisy chrome://extensions error until the tab reloads.
    return undefined;
  }
}
