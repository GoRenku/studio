import type {
  ImageRevisionEditorContext,
  ImageRevisionEstimateReport,
} from '@gorenku/studio-core/client';
import { buildGenerationPreviewResource } from './generation-preview.js';

export async function buildStudioImageRevisionContext(input: {
  projectName: string;
  context: ImageRevisionEditorContext;
}) {
  const [regenerate, edit] = await Promise.all([
    buildStudioImageRevisionModeContext({
      projectName: input.projectName,
      modeContext: input.context.regenerate,
    }),
    buildStudioImageRevisionModeContext({
      projectName: input.projectName,
      modeContext: input.context.edit,
    }),
  ]);
  return {
    ...input.context,
    regenerate,
    edit,
  };
}

async function buildStudioImageRevisionModeContext(input: {
  projectName: string;
  modeContext: ImageRevisionEditorContext['regenerate'];
}) {
  return input.modeContext.state === 'available'
    ? {
        ...input.modeContext,
        preview: await buildGenerationPreviewResource({
          projectName: input.projectName,
          preview: input.modeContext.preview,
        }),
      }
    : input.modeContext;
}

export async function buildStudioImageRevisionEstimate(input: {
  projectName: string;
  estimate: ImageRevisionEstimateReport;
}) {
  return {
    ...input.estimate,
    preview: await buildGenerationPreviewResource({
      projectName: input.projectName,
      preview: input.estimate.preview,
    }),
  };
}
