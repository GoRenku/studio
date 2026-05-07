import { readStudioApiError } from './studio-api-errors';
import type {
  StudioCurrentResponse,
  StudioEventsResponse,
  StudioFocus,
  StudioFocusRequestValidationResponse,
  StudioProjectRef,
} from './studio-current-contracts';

export async function readStudioEvents(after?: string): Promise<StudioEventsResponse> {
  const params = after ? `?after=${encodeURIComponent(after)}` : '';
  const response = await fetch(`/studio-api/studio/events${params}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as StudioEventsResponse;
}

export async function readStudioCurrent(): Promise<StudioCurrentResponse> {
  const response = await fetch('/studio-api/studio/events/current');
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as StudioCurrentResponse;
}

export async function reportBrowserSessionActive(
  browserSessionId: string
): Promise<void> {
  await postStudioEvent('/studio-api/studio/events/browser-sessions/active', {
    browserSessionId,
  });
}

export async function reportStudioFocusChanged(input: {
  browserSessionId: string;
  projectRef?: StudioProjectRef;
  focus: StudioFocus;
  appliedRequestId?: string;
}): Promise<void> {
  await postStudioEvent('/studio-api/studio/events/focus-changes', input);
}

export async function reportStudioFocusRequestFailed(input: {
  browserSessionId: string;
  requestEventId: string;
  reason:
    | 'projectNotFound'
    | 'projectRefMismatch'
    | 'selectionNotFound'
    | 'unsupportedSelection';
  diagnostics: unknown[];
}): Promise<void> {
  await postStudioEvent('/studio-api/studio/events/focus-failures', input);
}

export async function validateStudioFocusRequest(input: {
  projectName: string;
  focus: StudioFocus;
}): Promise<StudioFocusRequestValidationResponse> {
  const response = await fetch(
    '/studio-api/studio/events/focus-requests/validate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as StudioFocusRequestValidationResponse;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}

async function postStudioEvent(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
}
