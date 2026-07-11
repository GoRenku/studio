import type {
  ImageRevisionEditorContext,
  ImageRevisionEstimateReport,
} from '@gorenku/studio-core/client';
import { buildStudioGenerationPreview } from './generation-preview.js';

export async function buildStudioImageRevisionContext(input: {
  projectName: string;
  context: ImageRevisionEditorContext;
}) {
  return {
    ...input.context,
    regenerate:
      input.context.regenerate.state === 'available'
        ? {
            ...input.context.regenerate,
            preview: input.context.regenerate.preview
              ? await buildStudioGenerationPreview({
                  projectName: input.projectName,
                  preview: input.context.regenerate.preview,
                })
              : null,
          }
        : input.context.regenerate,
  };
}

export async function buildStudioImageRevisionEstimate(input: {
  projectName: string;
  estimate: ImageRevisionEstimateReport;
}) {
  return {
    ...input.estimate,
    preview: await buildStudioGenerationPreview({
      projectName: input.projectName,
      preview: input.estimate.preview,
    }),
  };
}
