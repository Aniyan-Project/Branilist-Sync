import type { ExtensionSettings } from './types';

const SETTINGS_KEY = 'branilist.settings.v1';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoSync: true,
  showToast: true,
  toastDurationSeconds: 30,
  quickPlusStartsCurrent: true,
};

export function sanitizeSettings(value: unknown): ExtensionSettings {
  const raw = value && typeof value === 'object' ? value as Partial<ExtensionSettings> : {};
  const duration = Number(raw.toastDurationSeconds);
  return {
    autoSync: typeof raw.autoSync === 'boolean' ? raw.autoSync : DEFAULT_SETTINGS.autoSync,
    showToast: typeof raw.showToast === 'boolean' ? raw.showToast : DEFAULT_SETTINGS.showToast,
    toastDurationSeconds: Number.isFinite(duration)
      ? Math.max(5, Math.min(120, Math.round(duration)))
      : DEFAULT_SETTINGS.toastDurationSeconds,
    quickPlusStartsCurrent: typeof raw.quickPlusStartsCurrent === 'boolean'
      ? raw.quickPlusStartsCurrent
      : DEFAULT_SETTINGS.quickPlusStartsCurrent,
  };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  const sanitized = sanitizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: sanitized });
  return sanitized;
}
