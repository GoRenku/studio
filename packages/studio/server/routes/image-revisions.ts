import {
  estimateImageRevisionDraft as coreEstimateImageRevisionDraft,
  previewImageRevisionDraft as corePreviewImageRevisionDraft,
  readImageRevisionContext as coreReadImageRevisionContext,
  runImageRevision as coreRunImageRevision,
} from '@gorenku/studio-core/server';
import type {
  ImageRevisionDraft,
  ImageRevisionTarget,
} from '@gorenku/studio-core/client';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  buildStudioImageRevisionContext,
  buildStudioImageRevisionEstimate,
} from '../projections/image-revision.js';
import { buildGenerationPreviewResource } from '../projections/generation-preview.js';

export interface ImageRevisionRouteCommands {
  readImageRevisionContext: typeof coreReadImageRevisionContext;
  previewImageRevisionDraft: typeof corePreviewImageRevisionDraft;
  estimateImageRevisionDraft: typeof coreEstimateImageRevisionDraft;
  runImageRevision: typeof coreRunImageRevision;
}

export interface CreateImageRevisionsRouteOptions {
  commands?: ImageRevisionRouteCommands;
  requireToken: MiddlewareHandler;
}

const coreCommands: ImageRevisionRouteCommands = {
  readImageRevisionContext: coreReadImageRevisionContext,
  previewImageRevisionDraft: corePreviewImageRevisionDraft,
  estimateImageRevisionDraft: coreEstimateImageRevisionDraft,
  runImageRevision: coreRunImageRevision,
};

export function createImageRevisionsRoute(
  options: CreateImageRevisionsRouteOptions,
) {
  const commands = options.commands ?? coreCommands;
  return new Hono()
    .post('/image-revisions/context', options.requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = readContextBody(await c.req.json());
        const context = await commands.readImageRevisionContext({
          projectName,
          target: body.target,
        });
        return c.json({
          context: await buildStudioImageRevisionContext({
            projectName,
            context,
          }),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/image-revisions/preview', options.requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = readDraftBody(await c.req.json());
        const preview = await commands.previewImageRevisionDraft({
          projectName,
          target: body.target,
          draft: body.draft,
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
    })
    .post('/image-revisions/estimate', options.requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = readDraftBody(await c.req.json());
        const estimate = await commands.estimateImageRevisionDraft({
          projectName,
          target: body.target,
          draft: body.draft,
        });
        return c.json({
          estimate: await buildStudioImageRevisionEstimate({
            projectName,
            estimate,
          }),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/image-revisions/run', options.requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = readDraftBody(await c.req.json());
        const report = await commands.runImageRevision({
          projectName,
          target: body.target,
          draft: body.draft,
          approveLiveProviderRun: true,
        });
        return c.json({ report });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

function readContextBody(value: unknown): { target: ImageRevisionTarget } {
  const body = requireObject(value, 'Request body');
  return { target: requireObject(body.target, 'target') as ImageRevisionTarget };
}

function readDraftBody(value: unknown): {
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
} {
  const body = requireObject(value, 'Request body');
  return {
    target: requireObject(body.target, 'target') as ImageRevisionTarget,
    draft: requireObject(body.draft, 'draft') as unknown as ImageRevisionDraft,
  };
}

function requireObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createStructuredError({
      code: 'STUDIO_SERVER084',
      message: `${label} must be an object.`,
    });
  }
  return value as Record<string, unknown>;
}
