import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

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

  const { runtimeContextAvailable, sendRuntimeMessage } = await import('../src/content/runtime');

  expect(runtimeContextAvailable()).toBe(true);
  await expect(sendRuntimeMessage({ type: 'PROVIDER_DIAGNOSTIC' })).resolves.toBeUndefined();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(runtimeContextAvailable()).toBe(false);
});

it('does not call messaging when no runtime sender is available', async () => {
  vi.stubGlobal('chrome', {
    runtime: {},
  });

  const { runtimeContextAvailable, sendRuntimeMessage } = await import('../src/content/runtime');

  expect(runtimeContextAvailable()).toBe(false);
  await expect(sendRuntimeMessage({ type: 'TRACKER_DETECTED' })).resolves.toBeUndefined();
});
