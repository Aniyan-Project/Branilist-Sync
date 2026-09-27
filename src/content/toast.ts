import type { CatalogSearchItem, CatalogSearchResponse, DetectedMedia, ExtensionSettings, ResolveResult } from '../core/types';
import { sendRuntimeMessage } from './runtime';

const SEARCH_BASE = 'https://branilist.com/api/v1/search';

let lastDetectionToastKey = '';

function detectionToastKey(media: DetectedMedia): string {
  if (media.providerEpisodeId) return `${media.providerId}|episode:${media.providerEpisodeId}`;
  return [
    media.providerId,
    media.providerMediaId ?? '',
    media.episode ?? '',
    media.chapter ?? '',
  ].join('|');
}

function preferredTitle(item: CatalogSearchItem): string {
  return item.title.portuguese || item.title.english || item.title.romaji || `Branilist #${item.id}`;
}

export async function searchCatalog(query: string, kind: DetectedMedia['kind']): Promise<CatalogSearchItem[]> {
  const response = await fetch(`${SEARCH_BASE}?q=${encodeURIComponent(query)}&limit=12`, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Falha ao pesquisar no Branilist.');
  const body = await response.json() as CatalogSearchResponse;
  return body.items.filter(item => item.type === kind);
}

export interface DetectionFeedback {
  authenticated?: boolean;
  result?: ResolveResult;
  resolveError?: boolean;
  settings?: ExtensionSettings;
}

export function showDetectionToast(media: DetectedMedia, feedback: DetectionFeedback): void {
  const key = detectionToastKey(media);
  if (key === lastDetectionToastKey) return;
  lastDetectionToastKey = key;

  document.querySelector('#branilist-sync-toast-host')?.remove();

  const host = document.createElement('div');
  host.id = 'branilist-sync-toast-host';
  host.style.position = 'fixed';
  host.style.top = '18px';
  host.style.right = '18px';
  host.style.zIndex = '2147483647';
  document.documentElement.append(host);

  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .toast {
        width: 340px;
        max-height: min(78vh, 640px);
        overflow: auto;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #111827;
        color: #e5eefb;
        border: 1px solid #283750;
        border-radius: 14px;
        box-shadow: 0 18px 44px rgba(0,0,0,.45);
      }
      .top { padding: 14px 15px 12px; display:flex; gap:12px; align-items:flex-start; }
      .mark { width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,#65b7ff,#7c6cff); display:grid; place-items:center; font-weight:800; color:#fff; flex:0 0 auto; }
      .copy { min-width:0; flex:1; }
      .eyebrow { color:#8da4c3; font-size:11px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px; }
      .title { font-size:14px; font-weight:700; line-height:1.3; overflow-wrap:anywhere; }
      .status { margin-top:5px; font-size:12px; line-height:1.4; color:#afbdd0; }
      .actions { padding:0 15px 14px; display:flex; gap:8px; }
      button { border:0; border-radius:9px; padding:8px 11px; font:600 12px inherit; cursor:pointer; }
      .primary { background:#4ea1ff; color:#08111e; }
      .secondary { background:#243247; color:#dbe8f8; }
      .close { background:transparent; color:#8da4c3; padding:2px 5px; font-size:17px; }
      .panel { display:none; border-top:1px solid #283750; padding:13px 15px 15px; }
      .panel.open { display:block; }
      form { display:flex; gap:7px; }
      input { flex:1; min-width:0; border:1px solid #33445e; border-radius:9px; background:#0d1522; color:#eef5ff; padding:9px 10px; outline:none; }
      input:focus { border-color:#5ba9ff; }
      .results { display:grid; gap:7px; margin-top:10px; }
      .result { width:100%; display:grid; grid-template-columns:40px 1fr; gap:9px; text-align:left; padding:7px; background:#182438; color:#ecf4ff; }
      .result:hover { background:#21324d; }
      .poster { width:40px; height:56px; border-radius:6px; object-fit:cover; background:#0d1522; }
      .result-title { font-size:12px; font-weight:700; line-height:1.3; }
      .meta { font-size:11px; color:#8fa2bd; margin-top:3px; }
      .hint { font-size:11px; color:#8195b2; margin-top:8px; line-height:1.4; }
      .error { color:#ff9c9c; font-size:11px; margin-top:8px; }
      @media (max-width: 520px) { .toast { width:calc(100vw - 24px); } }
    </style>
    <div class="toast">
      <div class="top">
        <div class="mark">B</div>
        <div class="copy">
          <div class="eyebrow">Branilist Sync</div>
          <div class="title"></div>
          <div class="status"></div>
        </div>
        <button class="close" type="button" aria-label="Fechar">×</button>
      </div>
      <div class="actions"></div>
      <div class="panel">
        <form>
          <input type="search" maxlength="120" placeholder="Pesquisar no Branilist" autocomplete="off" />
          <button class="primary" type="submit">Buscar</button>
        </form>
        <div class="results"></div>
        <div class="hint">A correção vale apenas para sua conta. Ela não cria um mapping global para outros usuários.</div>
        <div class="error"></div>
      </div>
    </div>
  `;

  const title = root.querySelector<HTMLElement>('.title')!;
  const status = root.querySelector<HTMLElement>('.status')!;
  const actions = root.querySelector<HTMLElement>('.actions')!;
  const close = root.querySelector<HTMLButtonElement>('.close')!;
  const panel = root.querySelector<HTMLElement>('.panel')!;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const input = root.querySelector<HTMLInputElement>('input')!;
  const results = root.querySelector<HTMLElement>('.results')!;
  const error = root.querySelector<HTMLElement>('.error')!;

  title.textContent = `Anime detectado: ${media.title}`;

  const addAction = (label: string, primary: boolean, onClick: () => void) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = primary ? 'primary' : 'secondary';
    button.textContent = label;
    button.addEventListener('click', onClick);
    actions.append(button);
  };

  if (!feedback.authenticated) {
    status.textContent = 'Vincule sua conta no Branilist Sync para confirmar a correspondência e sincronizar o progresso.';
  } else if (feedback.resolveError) {
    status.textContent = 'Anime detectado, mas não foi possível consultar o Branilist agora.';
  } else if (feedback.result?.matched && !feedback.result.requiresConfirmation) {
    status.textContent = `Correspondência segura encontrada no Branilist (#${feedback.result.mediaId}).`;
  } else {
    status.textContent = 'A correspondência precisa de confirmação antes de qualquer atualização na sua lista.';
    addAction('Corrigir correspondência', true, () => {
      panel.classList.add('open');
      input.value = media.title;
      input.focus();
    });
  }

  addAction('Ocultar', false, () => host.remove());
  close.addEventListener('click', () => host.remove());

  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length < 2) return;
    error.textContent = '';
    results.textContent = '';
    void searchCatalog(query, media.kind).then(items => {
      if (!items.length) {
        error.textContent = 'Nenhum resultado compatível encontrado.';
        return;
      }
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'result';

        const image = document.createElement('img');
        image.className = 'poster';
        image.alt = '';
        if (item.coverImage) image.src = item.coverImage;

        const copy = document.createElement('div');
        const resultTitle = document.createElement('div');
        resultTitle.className = 'result-title';
        resultTitle.textContent = preferredTitle(item);
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `${item.format || item.type} • Branilist #${item.id}`;
        copy.append(resultTitle, meta);
        button.append(image, copy);

        button.addEventListener('click', () => {
          error.textContent = '';
          button.disabled = true;
          void sendRuntimeMessage({
            type: 'SAVE_USER_MAPPING',
            payload: { media, mediaId: item.id },
          }).then(response => {
            if (!response?.ok || !response.result?.matched) {
              throw new Error(response?.error ?? 'Não foi possível salvar a correção.');
            }
            status.textContent = `Correspondência corrigida: ${preferredTitle(item)}.`;
            panel.classList.remove('open');
            actions.textContent = '';
            addAction('Ocultar', false, () => host.remove());
          }).catch(err => {
            error.textContent = err instanceof Error ? err.message : 'Não foi possível salvar a correção.';
            button.disabled = false;
          });
        });

        results.append(button);
      }
    }).catch(err => {
      error.textContent = err instanceof Error ? err.message : 'Falha ao pesquisar no Branilist.';
    });
  });

  window.setTimeout(() => {
    if (!panel.classList.contains('open')) host.remove();
  }, Math.max(5, Math.min(120, feedback.settings?.toastDurationSeconds ?? 30)) * 1000);
}


export function showEpisodeChangeToast(
  previousEpisodeId: string | undefined,
  episodeProviderId: string,
  durationSeconds = 12,
): void {
  document.querySelector('#branilist-sync-episode-change-host')?.remove();

  const host = document.createElement('div');
  host.id = 'branilist-sync-episode-change-host';
  host.style.position = 'fixed';
  host.style.top = '18px';
  host.style.right = '18px';
  host.style.zIndex = '2147483647';
  document.documentElement.append(host);

  const root = host.attachShadow({ mode: 'closed' });
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'width:340px',
    'font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'background:#111827',
    'color:#e5eefb',
    'border:1px solid #31517a',
    'border-radius:14px',
    'box-shadow:0 18px 44px rgba(0,0,0,.45)',
    'padding:14px 15px',
  ].join(';');

  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:800;line-height:1.3';
  title.textContent = 'Mudança de episódio detectada';

  const detail = document.createElement('div');
  detail.style.cssText = 'margin-top:6px;font-size:11px;line-height:1.45;color:#9fb1c8';
  detail.textContent = previousEpisodeId
    ? `${previousEpisodeId} → ${episodeProviderId}. Aguardando os metadados do novo episódio…`
    : `Novo episódio ${episodeProviderId} detectado. Aguardando os metadados…`;

  wrap.append(title, detail);
  root.append(wrap);

  window.setTimeout(() => host.remove(), Math.max(5, Math.min(120, durationSeconds)) * 1000);
}
