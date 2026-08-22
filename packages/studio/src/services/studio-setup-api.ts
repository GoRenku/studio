import type {
  RenkuSetup,
  RenkuSetupInitializationReport,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

interface SetupApiResponse {
  setup?: RenkuSetup;
}

interface SetupInitializationApiResponse {
  report?: RenkuSetupInitializationReport;
}

export async function readRenkuSetup(): Promise<RenkuSetup> {
  const response = await fetch('/studio-api/setup', {
    cache: 'no-store',
    headers: studioSetupHeaders(),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as SetupApiResponse;
  if (!body.setup) {
    throw new Error('Renku Studio API returned no setup resource.');
  }
  return body.setup;
}

export async function initializeRenkuSetup(): Promise<RenkuSetupInitializationReport> {
  const response = await fetch('/studio-api/setup', {
    method: 'POST',
    cache: 'no-store',
    headers: studioSetupHeaders(),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as SetupInitializationApiResponse;
  if (!body.report) {
    throw new Error('Renku Studio API returned no setup initialization report.');
  }
  return body.report;
}

function studioSetupHeaders(): Record<string, string> {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return { 'X-Renku-Studio-Token': token };
}
