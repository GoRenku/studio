import type {
  GenerationOutputMediaKind,
  GenerationReference,
} from '@gorenku/studio-core/client';
import type { ProjectDataService } from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  readOptionalQueryString,
  readPageRequest,
} from '../http/pagination-request.js';

export interface GenerationReferenceCatalogResponseItem {
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

export function createGenerationReferencesRoute(options: {
  projectData: Pick<ProjectDataService, 'listGenerationReferences'>;
  requireToken: MiddlewareHandler;
}) {
  return new Hono().get(
    '/generation-references',
    options.requireToken,
    async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const query = c.req.query();
        const mediaKind = readMediaKind(query.mediaKind);
        const page = await options.projectData.listGenerationReferences({
          projectName,
          ...readPageRequest(query),
          search: readOptionalQueryString(query.search),
          ...(mediaKind ? { mediaKind } : {}),
        });
        return c.json({
          items: page.items.map((item): GenerationReferenceCatalogResponseItem => {
            if (item.reference.kind !== 'asset-file') {
              throw requestError('The project media catalog returned a non-asset reference.');
            }
            return {
              reference: item.reference,
              label: item.label,
              mediaKind: item.mediaKind,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
              width: item.width,
              height: item.height,
              durationSeconds: item.durationSeconds,
              role: item.role,
              provenance: item.provenance,
              browserUrl: `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(item.reference.assetId)}/files/${encodeURIComponent(item.reference.assetFileId)}`,
            };
          }),
          nextCursor: page.nextCursor,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    },
  );
}

function readMediaKind(
  value: string | undefined,
): GenerationOutputMediaKind | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'image' || value === 'audio' || value === 'video') {
    return value;
  }
  throw requestError('mediaKind must be image, audio, or video when provided.');
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER347',
    message,
  });
}
