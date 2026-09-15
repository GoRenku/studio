import { readStudioApiError, StudioApiError } from './studio-api-errors';

let pendingBootstrap: Promise<string> | undefined;

export function readStudioApiToken(): string {
  return window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken ?? '';
}

export async function studioApiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Renku-Studio-Token')) return init ? fetch(url, init) : fetch(url);
  if (!url.startsWith('/studio-api/')) {
    throw new StudioApiError('Studio authentication requires a local API path.', 'STUDIO_CLIENT001', 0);
  }
  const token = readStudioApiToken() || await refreshStudioApiToken();
  const response = await fetch(url, withToken(init, token));
  if (response.status !== 403) return response;
  const body = await response.clone().json().catch(() => null);
  if (body?.error?.code !== 'STUDIO_SERVER021') return response;
  // This rejection happens before the handler runs, so retrying cannot repeat
  // a successful mutation. Network failures and other errors are never retried.
  const currentToken = readStudioApiToken();
  const nextToken = currentToken && currentToken !== token
    ? currentToken
    : await refreshStudioApiToken();
  return fetch(url, withToken(init, nextToken));
}

function withToken(init: RequestInit | undefined, token: string): RequestInit {
  const source = init?.headers instanceof Headers || Array.isArray(init?.headers)
    ? Object.fromEntries(new Headers(init.headers))
    : init?.headers;
  const headers = Object.fromEntries(Object.entries(source ?? {}).filter(
    ([name]) => name.toLowerCase() !== 'x-renku-studio-token'
  ));
  return { ...init, headers: { ...headers, 'X-Renku-Studio-Token': token } };
}

async function refreshStudioApiToken(): Promise<string> {
  pendingBootstrap ??= fetchStudioBootstrap().finally(() => {
    pendingBootstrap = undefined;
  });
  return pendingBootstrap;
}

async function fetchStudioBootstrap(): Promise<string> {
  const response = await fetch('/studio-api/bootstrap', {
    cache: 'no-store',
    headers: { 'X-Renku-Studio-Bootstrap': '1' },
  });
  if (!response.ok) throw await readStudioApiError(response);
  const body = await response.json();
  if (typeof body?.studioApiToken !== 'string' || !body.studioApiToken) {
    throw new StudioApiError('Studio bootstrap returned no API token.', 'STUDIO_CLIENT002', response.status);
  }
  window.__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: body.studioApiToken };
  return body.studioApiToken;
}
