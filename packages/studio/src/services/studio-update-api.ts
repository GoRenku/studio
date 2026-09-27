import type { RenkuUpdateStatus } from '@gorenku/studio-core/client';
import { readStudioApiError, StudioApiError } from './studio-api-errors';
import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';

export async function readStudioUpdateStatus(): Promise<RenkuUpdateStatus> {
  const response = await studioApiFetch('/studio-api/studio/update', {
    cache: 'no-store',
    headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
  });
  if (!response.ok) throw await readStudioApiError(response);
  const body = await response.json();
  const status = body?.status;
  if (!status || (status.state !== 'notInstalled' &&
      !(['current', 'available'].includes(status.state) &&
        typeof status.installedVersion === 'string' &&
        typeof status.publishedVersion === 'string'))) {
    throw new StudioApiError('Studio returned no update status.', 'STUDIO_CLIENT003', response.status);
  }
  return status as RenkuUpdateStatus;
}

export async function startStudioUpdate(): Promise<{ started: true; publishedVersion: string }> {
  const response = await studioApiFetch('/studio-api/studio/update', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
  });
  if (!response.ok) throw await readStudioApiError(response);
  const body = await response.json();
  if (body?.started !== true || typeof body.publishedVersion !== 'string') {
    throw new StudioApiError('Studio did not confirm the terminal handoff.', 'STUDIO_CLIENT004', response.status);
  }
  return body;
}
