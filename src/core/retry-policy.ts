export type SyncRetryKind =
  | 'network'
  | 'rate_limit'
  | 'server'
  | 'auth'
  | 'client'
  | 'unknown';

export interface RetryDecision {
  autoRetry: boolean;
  kind: SyncRetryKind;
  httpStatus?: number;
  retryAfterMs?: number;
  message: string;
}

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  status?: unknown;
  retryAfterMs?: unknown;
};

function safeStatus(value: unknown): number | undefined {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

function safeRetryAfter(value: unknown): number | undefined {
  const ms = Number(value);
  return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, 24 * 60 * 60 * 1000) : undefined;
}

export function classifySyncError(error: unknown): RetryDecision {
  const value = error && typeof error === 'object' ? error as ErrorLike : {};
  const status = safeStatus(value.status);
  const retryAfterMs = safeRetryAfter(value.retryAfterMs);
  const name = typeof value.name === 'string' ? value.name : '';
  const message = typeof value.message === 'string' ? value.message : String(error ?? '');

  if (status === 401 || /sess[aã]o branilist expirada|conta branilist n[aã]o vinculada/i.test(message)) {
    return {
      autoRetry: false,
      kind: 'auth',
      httpStatus: status ?? 401,
      message: 'A sessão do Branilist expirou. Vincule a conta novamente antes de tentar sincronizar.',
    };
  }

  if (status === 429) {
    return {
      autoRetry: true,
      kind: 'rate_limit',
      httpStatus: status,
      retryAfterMs,
      message: 'O Branilist limitou temporariamente as requisições. Uma nova tentativa será feita automaticamente.',
    };
  }

  if (status === 408) {
    return {
      autoRetry: true,
      kind: 'network',
      httpStatus: status,
      retryAfterMs,
      message: 'A comunicação com o Branilist expirou. Uma nova tentativa será feita automaticamente.',
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      autoRetry: true,
      kind: 'server',
      httpStatus: status,
      retryAfterMs,
      message: 'O Branilist está temporariamente indisponível. Uma nova tentativa será feita automaticamente.',
    };
  }

  if (status !== undefined && status >= 400) {
    return {
      autoRetry: false,
      kind: 'client',
      httpStatus: status,
      message: `O Branilist rejeitou a sincronização (HTTP ${status}). Verifique a pendência antes de tentar novamente.`,
    };
  }

  if (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    (name === 'TypeError' && /fetch|network|failed|load/i.test(message)) ||
    /networkerror|failed to fetch|network request failed|connection lost|offline/i.test(message)
  ) {
    return {
      autoRetry: true,
      kind: 'network',
      message: 'Sem conexão confiável com o Branilist. Uma nova tentativa será feita automaticamente.',
    };
  }

  return {
    autoRetry: false,
    kind: 'unknown',
    message: 'Não foi possível confirmar a sincronização. Verifique a pendência antes de tentar novamente.',
  };
}

export function retryDelayMs(
  decision: Pick<RetryDecision, 'kind' | 'retryAfterMs'>,
  attempts: number,
  random = Math.random(),
): number {
  const safeAttempts = Math.max(1, Math.floor(attempts));
  const base = decision.kind === 'network'
    ? 30_000
    : decision.kind === 'server'
      ? 60_000
      : decision.kind === 'rate_limit'
        ? 60_000
        : 60_000;

  const exponential = Math.min(base * 2 ** Math.min(safeAttempts - 1, 16), 6 * 60 * 60 * 1000);
  const retryAfter = decision.retryAfterMs ?? 0;
  const floor = Math.max(exponential, retryAfter);
  const jitter = 0.85 + Math.min(1, Math.max(0, random)) * 0.30;

  return Math.max(30_000, Math.round(floor * jitter));
}
