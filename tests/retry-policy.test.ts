import { describe, expect, it } from 'vitest';
import { classifySyncError, retryDelayMs } from '../src/core/retry-policy';

describe('sync retry policy', () => {
  it('retries network failures automatically', () => {
    expect(classifySyncError(new TypeError('Failed to fetch'))).toMatchObject({
      autoRetry: true,
      kind: 'network',
    });
  });

  it('does not loop automatically on expired auth', () => {
    expect(classifySyncError({ status: 401, message: 'Sessão Branilist expirada' })).toMatchObject({
      autoRetry: false,
      kind: 'auth',
      httpStatus: 401,
    });
  });

  it('honors rate limits and server failures', () => {
    expect(classifySyncError({ status: 429, retryAfterMs: 120_000 })).toMatchObject({
      autoRetry: true,
      kind: 'rate_limit',
      httpStatus: 429,
      retryAfterMs: 120_000,
    });
    expect(classifySyncError({ status: 503 })).toMatchObject({
      autoRetry: true,
      kind: 'server',
      httpStatus: 503,
    });
  });

  it('keeps permanent 4xx failures manual', () => {
    expect(classifySyncError({ status: 422 })).toMatchObject({
      autoRetry: false,
      kind: 'client',
      httpStatus: 422,
    });
  });

  it('uses exponential backoff with bounded jitter and Retry-After floor', () => {
    expect(retryDelayMs({ kind: 'network' }, 1, 0.5)).toBe(30_000);
    expect(retryDelayMs({ kind: 'network' }, 2, 0.5)).toBe(60_000);
    expect(retryDelayMs({ kind: 'rate_limit', retryAfterMs: 120_000 }, 1, 0.5)).toBe(120_000);
    expect(retryDelayMs({ kind: 'server' }, 20, 0.5)).toBe(6 * 60 * 60 * 1000);
  });
});
