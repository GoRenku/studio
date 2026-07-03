import {
  isStudioRuntimeDescriptorUsable,
  readStudioRuntimeDescriptor,
  type GenerationPreviewSnapshot,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';

const DEFAULT_STUDIO_NOTIFICATION_REQUEST_TIMEOUT_MS = 2_000;

export type StudioNotificationDeliveryResult =
  | { status: 'notRunning' }
  | { status: 'notConfigured' }
  | { status: 'delivered' }
  | {
      status: 'deliveryFailed';
      serverUrl: string;
      detail: string;
    };

export interface StudioProjectResourcesChangedNotification {
  projectRef: StudioProjectRef;
  resourceKeys: string[];
  source: { kind: 'cli'; command: string };
  operationId?: string;
}

export interface StudioGenerationPreviewNotification {
  projectRef: StudioProjectRef;
  preview: GenerationPreviewSnapshot;
  source: { kind: 'cli'; command: string };
  operationId?: string;
}

export async function notifyStudioProjectResourcesChanged(input: {
  homeDir?: string;
  notification: StudioProjectResourcesChangedNotification;
  requestTimeoutMs?: number;
  now?: Date;
}): Promise<StudioNotificationDeliveryResult> {
  const descriptor = await readStudioRuntimeDescriptor({
    homeDir: input.homeDir,
  });
  if (!descriptor || !isStudioRuntimeDescriptorUsable(descriptor, input.now)) {
    return { status: 'notRunning' };
  }
  if (!descriptor.cliNotificationToken) {
    return { status: 'notConfigured' };
  }

  return postStudioNotification({
    serverUrl: descriptor.serverUrl,
    token: descriptor.cliNotificationToken,
    path: '/studio-api/studio/events/project-resources-changed',
    body: input.notification,
    requestTimeoutMs:
      input.requestTimeoutMs ?? DEFAULT_STUDIO_NOTIFICATION_REQUEST_TIMEOUT_MS,
  });
}

export async function notifyStudioGenerationPreview(input: {
  homeDir?: string;
  notification: StudioGenerationPreviewNotification;
  requestTimeoutMs?: number;
  now?: Date;
}): Promise<StudioNotificationDeliveryResult> {
  const descriptor = await readStudioRuntimeDescriptor({
    homeDir: input.homeDir,
  });
  if (!descriptor || !isStudioRuntimeDescriptorUsable(descriptor, input.now)) {
    return { status: 'notRunning' };
  }
  if (!descriptor.cliNotificationToken) {
    return { status: 'notConfigured' };
  }

  return postStudioNotification({
    serverUrl: descriptor.serverUrl,
    token: descriptor.cliNotificationToken,
    path: '/studio-api/studio/events/generation-previews',
    body: input.notification,
    requestTimeoutMs:
      input.requestTimeoutMs ?? DEFAULT_STUDIO_NOTIFICATION_REQUEST_TIMEOUT_MS,
  });
}

async function postStudioNotification(input: {
  serverUrl: string;
  token: string;
  path: string;
  body: unknown;
  requestTimeoutMs: number;
}): Promise<StudioNotificationDeliveryResult> {
  let endpoint: URL;
  try {
    endpoint = new URL(input.path, input.serverUrl);
  } catch {
    return {
      status: 'deliveryFailed',
      serverUrl: input.serverUrl,
      detail: 'Studio runtime descriptor has an invalid server URL.',
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(input.requestTimeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': input.token,
      },
      body: JSON.stringify(input.body),
    });
    if (response.ok) {
      return { status: 'delivered' };
    }
    return {
      status: 'deliveryFailed',
      serverUrl: input.serverUrl,
      detail: await responseFailureDetail(response),
    };
  } catch (error) {
    return {
      status: 'deliveryFailed',
      serverUrl: input.serverUrl,
      detail: notificationRequestFailureDetail(error, input.requestTimeoutMs),
    };
  }
}

function notificationRequestFailureDetail(
  error: unknown,
  requestTimeoutMs: number
): string {
  if (isAbortError(error)) {
    return `Studio notification request timed out after ${requestTimeoutMs}ms.`;
  }
  return error instanceof Error
    ? error.message
    : 'Studio notification request failed.';
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

async function responseFailureDetail(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) {
    return `Studio server returned HTTP ${response.status}.`;
  }
  return `Studio server returned HTTP ${response.status}: ${text}`;
}
