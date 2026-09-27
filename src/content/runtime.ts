export function runtimeContextAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export async function sendRuntimeMessage<T = unknown>(message: unknown): Promise<T | undefined> {
  try {
    if (!runtimeContextAvailable()) return undefined;
    return await chrome.runtime.sendMessage(message) as T;
  } catch {
    // Reloading/updating an unpacked extension invalidates already injected
    // content-script contexts. That is expected during development and must
    // not surface as an unhandled promise rejection in chrome://extensions.
    return undefined;
  }
}
