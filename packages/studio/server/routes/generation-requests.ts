import fs from 'node:fs/promises';
import {
  readAssetFileGenerationRequest as coreReadAssetFileGenerationRequest,
  readGenerationReferenceProjectFile as coreReadGenerationReferenceProjectFile,
} from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { buildGenerationPreviewResource } from '../projections/generation-preview.js';

export interface GenerationRequestRouteCommands {
  readAssetFileGenerationRequest: typeof coreReadAssetFileGenerationRequest;
  readGenerationReferenceProjectFile: typeof coreReadGenerationReferenceProjectFile;
}

export function createGenerationRequestsRoute(options: {
  commands?: GenerationRequestRouteCommands;
  requireToken: MiddlewareHandler;
}) {
  const commands = options.commands ?? {
    readAssetFileGenerationRequest: coreReadAssetFileGenerationRequest,
    readGenerationReferenceProjectFile: coreReadGenerationReferenceProjectFile,
  };
  return new Hono()
    .get(
      '/assets/:assetId/files/:assetFileId/generation-request',
      options.requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const preview = await commands.readAssetFileGenerationRequest({
            projectName,
            assetId: c.req.param('assetId') as string,
            assetFileId: c.req.param('assetFileId') as string,
          });
          return c.json({
            preview: await buildGenerationPreviewResource({
              projectName,
              preview,
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      },
    )
    .get('/generation-reference-file', options.requireToken, async (c) => {
      try {
        const resolved = await commands.readGenerationReferenceProjectFile({
          projectName: c.req.param('projectName') as string,
          projectRelativePath: c.req.query('path') ?? '',
        });
        return new Response(await fs.readFile(resolved.absolutePath), {
          status: 200,
          headers: {
            'Content-Type': resolved.mimeType,
            'Cache-Control': 'private, max-age=31536000, immutable',
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
