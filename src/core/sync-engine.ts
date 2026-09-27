import { classifySyncError, retryDelayMs } from './retry-policy';
import type { DetectedMedia, ResolveResult, SyncState } from './types';
import { shouldTrackProgress } from './tracking';

export interface PendingEvent {
  id: string;
  media: DetectedMedia;
  occurredAt: string;
  state: SyncState;
}
export interface SyncSnapshot { events: PendingEvent[]; lastSync: SyncState }
export interface SyncDependencies {
  load(): Promise<SyncSnapshot | undefined>;
  save(snapshot: SyncSnapshot): Promise<void>;
  resolve(media: DetectedMedia): Promise<ResolveResult>;
  write(event: PendingEvent): Promise<ResolveResult>;
}
export type RetryMode = 'manual' | 'automatic';

export function safeResolution(result: ResolveResult): boolean {
  return result?.matched === true && result.requiresConfirmation === false &&
    Number.isSafeInteger(result.mediaId) && result.mediaId! > 0 &&
    Number.isFinite(result.confidence) && result.confidence >= 0.9 && result.confidence <= 1;
}

function validRetryTime(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// The worker serializes calls. Persist BEFORE sending, so restarts and uncertain
// network outcomes replay the same body and idempotency key.
export class SyncEngine {
  constructor(private deps: SyncDependencies) {}

  async snapshot(): Promise<SyncSnapshot> {
    return await this.deps.load() ?? {
      events: [],
      lastSync: { status: 'idle', updatedAt: new Date().toISOString() },
    };
  }

  async nextRetryAt(): Promise<number | undefined> {
    const snapshot = await this.snapshot();
    const times = snapshot.events
      .filter(event => event.state.status === 'error' && event.state.autoRetry === true)
      .map(event => validRetryTime(event.state.nextAttemptAt))
      .filter((value): value is number => value !== undefined);

    return times.length ? Math.min(...times) : undefined;
  }

  async dueRetryIds(now = Date.now()): Promise<string[]> {
    const snapshot = await this.snapshot();
    return snapshot.events
      .filter(event => {
        if (event.state.status !== 'error' || event.state.autoRetry !== true) return false;
        const next = validRetryTime(event.state.nextAttemptAt);
        return next !== undefined && next <= now;
      })
      .map(event => event.id);
  }

  async run(media?: DetectedMedia, retryId?: string, mode: RetryMode = 'manual'): Promise<SyncState> {
    const snapshot = await this.snapshot();
    let event: PendingEvent | undefined;

    if (retryId) {
      event = snapshot.events.find(item => item.id === retryId);
      if (!event || event.state.status === 'synced') {
        throw new Error('Tentativa expirada. Detecte o episódio novamente.');
      }

      if (mode === 'automatic') {
        if (event.state.status !== 'error' || event.state.autoRetry !== true) return event.state;
        const next = validRetryTime(event.state.nextAttemptAt);
        if (next === undefined || next > Date.now()) return event.state;
      }
    } else {
      if (!media || !shouldTrackProgress(media)) throw new Error('Progresso inválido ou abaixo de 90%.');
      event = snapshot.events.find(item =>
        item.media.providerId === media.providerId &&
        item.media.providerMediaId === media.providerMediaId &&
        item.media.episode === media.episode
      );
      if (event) return event.state;

      // Never evict an uncertain write just to accept new work.
      if (snapshot.events.length >= 100) {
        const completed = snapshot.events.findIndex(item =>
          ['synced', 'ignored'].includes(item.state.status)
        );
        if (completed < 0) throw new Error('Resolva as tentativas pendentes antes de continuar.');
        snapshot.events.splice(completed, 1);
      }

      const now = new Date().toISOString();
      event = {
        id: crypto.randomUUID(),
        media: structuredClone(media),
        occurredAt: now,
        state: { status: 'resolved', updatedAt: now },
      };
      snapshot.events.push(event);
    }

    const current = event;
    const previousAttempts = current.state.attempts ?? 0;
    const persist = async (
      status: SyncState['status'],
      message: string,
      result?: ResolveResult,
      retry: Partial<Pick<
        SyncState,
        'attempts' | 'nextAttemptAt' | 'retryKind' | 'httpStatus' | 'autoRetry'
      >> = {},
    ) => {
      current.state = {
        status,
        message,
        result,
        media: current.media,
        retryId: current.id,
        updatedAt: new Date().toISOString(),
        ...retry,
      };
      snapshot.lastSync = current.state;
      await this.deps.save(snapshot);
      return current.state;
    };

    if (Date.now() - Date.parse(current.occurredAt) >= 30 * 24 * 60 * 60 * 1000) {
      return persist(
        'ignored',
        'Evento com mais de 30 dias. Confira sua lista no Branilist; esta tentativa expirou.',
      );
    }

    await persist(
      'resolved',
      mode === 'automatic' ? 'Tentando sincronizar novamente…' : 'Verificando correspondência…',
      undefined,
      previousAttempts ? { attempts: previousAttempts } : {},
    );

    try {
      const resolution = await this.deps.resolve(current.media);
      if (!safeResolution(resolution) || resolution.action !== 'MATCHED') {
        return await persist(
          'confirmation_required',
          'Revise a obra no Branilist. Verificar novamente consulta a correspondência; não força a confirmação.',
          resolution,
        );
      }

      const result = await this.deps.write(current);
      if (!safeResolution(result)) {
        return await persist(
          'confirmation_required',
          'O servidor exige revisão da correspondência.',
          result,
        );
      }

      if (!['PROGRESS_UPDATED', 'UNCHANGED'].includes(result.action)) {
        throw new Error('Resultado não reconhecido. Verifique sua lista antes de tentar novamente.');
      }

      return await persist(
        'synced',
        result.action === 'PROGRESS_UPDATED'
          ? `Progresso atualizado para ${result.newProgress}.`
          : 'Lista já estava atualizada.',
        result,
      );
    } catch (error) {
      const decision = classifySyncError(error);
      const attempts = previousAttempts + 1;
      const nextAttemptAt = decision.autoRetry
        ? new Date(Date.now() + retryDelayMs(decision, attempts)).toISOString()
        : undefined;

      return await persist(
        'error',
        decision.message,
        undefined,
        {
          attempts,
          nextAttemptAt,
          retryKind: decision.kind,
          httpStatus: decision.httpStatus,
          autoRetry: decision.autoRetry,
        },
      );
    }
  }
}
