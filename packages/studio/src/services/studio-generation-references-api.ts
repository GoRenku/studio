import type {
  GenerationOutputMediaKind,
  GenerationReference,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export interface StudioGenerationReferenceCatalogItem {
  reference: GenerationReference;
  label: string;
  mediaKind: GenerationOutputMediaKind;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  role: string;
  provenance: {
    origin: string;
    generationRunId?: string;
  };
  browserUrl: string;
}

export interface StudioGenerationReferenceCatalogPage {
  items: StudioGenerationReferenceCatalogItem[];
  nextCursor: string | null;
}

export async function listStudioGenerationReferences(input: {
  projectName: string;
  search?: string;
  cursor?: string;
  limit?: number;
  mediaKind?: GenerationOutputMediaKind;
}): Promise<StudioGenerationReferenceCatalogPage> {
  const query = new URLSearchParams();
  if (input.search) query.set('search', input.search);
  if (input.cursor) query.set('cursor', input.cursor);
  if (input.limit !== undefined) query.set('limit', String(input.limit));
  if (input.mediaKind) query.set('mediaKind', input.mediaKind);
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-references${suffix}`,
    { headers: { 'X-Renku-Studio-Token': readStudioApiToken() } },
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as StudioGenerationReferenceCatalogPage;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
