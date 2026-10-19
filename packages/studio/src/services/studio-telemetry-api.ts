import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import type { TelemetryChoice, TelemetryStatus } from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

interface TelemetryApiResponse {
  status?: TelemetryStatus;
}

export async function readTelemetryStatus(): Promise<TelemetryStatus> {
  const response = await studioApiFetch('/studio-api/telemetry', {
    cache: 'no-store',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  return readStatus(response);
}

export async function updateTelemetryChoice(choice: TelemetryChoice): Promise<TelemetryStatus> {
  const response = await studioApiFetch('/studio-api/telemetry', {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
    body: JSON.stringify(choice),
  });
  return readStatus(response);
}

async function readStatus(response: Response): Promise<TelemetryStatus> {
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as TelemetryApiResponse;
  if (!body.status) {
    throw new Error('Renku Studio API returned no usage statistics status.');
  }
  return body.status;
}
