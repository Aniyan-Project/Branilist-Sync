import { afterEach, expect, it, vi } from 'vitest';
import { runtimeContextAvailable, sendRuntimeMessage } from '../src/content/runtime';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('swallows an invalidated extension context instead of creating an unhandled rejection', async () => {
  const sendMessage = vi.fn(() => {
    throw new Error('Extension context invalidated.');
  });

  vi.stubGlobal('chrome', {
    runtime: {
      id: 'a'.repeat(32),
      sendMessage,
    },
  });

  await expect(sendRuntimeMessage({ type: 'PROVIDER_DIAGNOSTIC' })).resolves.toBeUndefined();
  expect(sendMessage).toHaveBeenCalledTimes(1);
});

it('does not call runtime messaging when the extension context is already unavailable', async () => {
  const sendMessage = vi.fn();

  vi.stubGlobal('chrome', {
    runtime: {
      id: undefined,
      sendMessage,
    },
  });

  expect(runtimeContextAvailable()).toBe(false);
  await expect(sendRuntimeMessage({ type: 'TRACKER_DETECTED' })).resolves.toBeUndefined();
  expect(sendMessage).not.toHaveBeenCalled();
});
