import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import type {
  ProviderCredentialsResource,
  ProviderCredentialsUpdate,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

interface ProviderCredentialsApiResponse {
  resource?: ProviderCredentialsResource;
}

export async function readProviderCredentials(): Promise<ProviderCredentialsResource> {
  const response = await studioApiFetch('/studio-api/provider-credentials', {
    cache: 'no-store',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  return readResource(response);
}

export async function updateProviderCredentials(
  update: ProviderCredentialsUpdate
): Promise<ProviderCredentialsResource> {
  const response = await studioApiFetch('/studio-api/provider-credentials', {
    method: 'PATCH',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
    body: JSON.stringify(update),
  });
  return readResource(response);
}

async function readResource(
  response: Response
): Promise<ProviderCredentialsResource> {
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ProviderCredentialsApiResponse;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no provider credential resource.');
  }
  return body.resource;
}
