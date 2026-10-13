import type { DefaultModelListResource } from '@gorenku/studio-core/client';
import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import { readStudioApiError } from './studio-api-errors';

interface DefaultModelListApiResponse {
  resource?: DefaultModelListResource;
}

export async function readDefaultModelList(): Promise<DefaultModelListResource> {
  const response = await studioApiFetch('/studio-api/default-models', {
    cache: 'no-store',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as DefaultModelListApiResponse;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no Default Model List resource.');
  }
  return body.resource;
}
