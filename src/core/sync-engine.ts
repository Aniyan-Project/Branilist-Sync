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
export function safeResolution(result: ResolveResult): boolean {
  return result?.matched === true && result.requiresConfirmation === false &&
    Number.isSafeInteger(result.mediaId) && result.mediaId! > 0 &&
    Number.isFinite(result.confidence) && result.confidence >= 0.9 && result.confidence <= 1;
}

// The worker serializes calls. Persist BEFORE sending, so restarts and uncertain
// network outcomes replay the same body and idempotency key.
export class SyncEngine {
  constructor(private deps: SyncDependencies) {}
  async snapshot(): Promise<SyncSnapshot> {
    return await this.deps.load() ?? { events: [], lastSync: { status: 'idle', updatedAt: new Date().toISOString() } };
  }
  async run(media?: DetectedMedia, retryId?: string): Promise<SyncState> {
    const snapshot = await this.snapshot();
    let event: PendingEvent | undefined;
    if (retryId) {
      event = snapshot.events.find(item => item.id === retryId);
      if (!event || event.state.status === 'synced') throw new Error('Tentativa expirada. Detecte o episódio novamente.');
    } else {
      if (!media || !shouldTrackProgress(media)) throw new Error('Progresso inválido ou abaixo de 90%.');
      event = snapshot.events.find(item => item.media.providerId === media.providerId &&
        item.media.providerMediaId === media.providerMediaId && item.media.episode === media.episode);
      if (event) return event.state;
      // Never evict an uncertain write just to accept new work.
      if (snapshot.events.length >= 100) {
        const completed = snapshot.events.findIndex(item => ['synced', 'ignored'].includes(item.state.status));
        if (completed < 0) throw new Error('Resolva as tentativas pendentes antes de continuar.');
        snapshot.events.splice(completed, 1);
      }
      event = { id: crypto.randomUUID(), media: structuredClone(media), occurredAt: new Date().toISOString(),
        state: { status: 'resolved', updatedAt: new Date().toISOString() } };
      snapshot.events.push(event);
    }
    const current = event;
    const persist = async (status: SyncState['status'], message: string, result?: ResolveResult) => {
      current.state = { status, message, result, media: current.media, retryId: current.id, updatedAt: new Date().toISOString() };
      snapshot.lastSync = current.state;
      await this.deps.save(snapshot);
      return current.state;
    };
    if (Date.now() - Date.parse(current.occurredAt) >= 30 * 24 * 60 * 60 * 1000) {
      return persist('ignored', 'Evento com mais de 30 dias. Confira sua lista no Branilist; esta tentativa expirou.');
    }
    await persist('resolved', 'Verificando correspondência…');
    try {
      const resolution = await this.deps.resolve(current.media);
      if (!safeResolution(resolution) || resolution.action !== 'MATCHED') {
        return await persist('confirmation_required', 'Revise a obra no Branilist. Verificar novamente consulta a correspondência; não força a confirmação.', resolution);
      }
      const result = await this.deps.write(current);
      if (!safeResolution(result)) return await persist('confirmation_required', 'O servidor exige revisão da correspondência.', result);
      if (!['PROGRESS_UPDATED', 'UNCHANGED'].includes(result.action)) {
        throw new Error('Resultado não reconhecido. Verifique sua lista antes de tentar novamente.');
      }
      return await persist('synced', result.action === 'PROGRESS_UPDATED' ? `Progresso atualizado para ${result.newProgress}.` : 'Lista já estava atualizada.', result);
    } catch {
      return await persist('error', 'Não foi possível confirmar a sincronização. Tente novamente; o mesmo evento será reutilizado.');
    }
  }
}
