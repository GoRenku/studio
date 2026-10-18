import type { StarNoteOffer } from '@gorenku/studio-core/client';
import { readStudioApiError, StudioApiError } from './studio-api-errors';
import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';

export async function requestStarNoteOffer(projectName: string): Promise<StarNoteOffer> {
  const response = await studioApiFetch('/studio-api/star-note', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
    body: JSON.stringify({ projectName }),
  });
  if (!response.ok) throw await readStudioApiError(response);
  const body = await response.json();
  if (typeof body?.offer?.show !== 'boolean') {
    throw new StudioApiError('Studio returned no star note offer.', 'STUDIO_CLIENT005', response.status);
  }
  return body.offer as StarNoteOffer;
}
