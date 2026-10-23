import type { ProductionPathResource } from '@gorenku/studio-core/client';
import { readStudioApiError } from '@/services/studio-api-errors';

export async function readProductionPath(projectName: string): Promise<ProductionPathResource> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/production-path`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { resource: ProductionPathResource | null };
  if (!body.resource) {
    throw new Error('Renku Studio API returned no Production Path resource.');
  }
  return body.resource;
}
