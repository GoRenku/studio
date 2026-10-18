import type { SampleFilm } from '@gorenku/studio-core/client';
import { readStudioApiError, StudioApiError } from './studio-api-errors';
import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';

export async function readSampleFilm(): Promise<SampleFilm> {
  const response = await studioApiFetch('/studio-api/sample-film', { cache: 'no-store' });
  return await readSampleFilmResponse(response);
}

export async function startSampleFilmInstallation(): Promise<SampleFilm> {
  const response = await studioApiFetch('/studio-api/sample-film', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
  });
  return await readSampleFilmResponse(response);
}

async function readSampleFilmResponse(response: Response): Promise<SampleFilm> {
  if (!response.ok) throw await readStudioApiError(response);
  const body = await response.json();
  const sampleFilm = body?.sampleFilm;
  if ((sampleFilm?.archiveBytes !== null && typeof sampleFilm?.archiveBytes !== 'number') ||
    typeof sampleFilm?.installation?.state !== 'string') {
    throw new StudioApiError('Studio returned no sample film state.', 'STUDIO_CLIENT006', response.status);
  }
  return sampleFilm as SampleFilm;
}
