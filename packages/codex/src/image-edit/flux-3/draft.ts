import { z } from 'zod';
import type { Flux3ImageEditDraft } from '../contracts.js';
import { assertNoImageEditIssues, imageEditIssue } from '../diagnostics.js';
import { imageEditRegionIssues, type ImageEditRegionModeRule } from '../region-validation.js';
import { imageEditIdentity, imageEditRegionBoxSchema, imageEditResolutionSchema } from '../schemas.js';
import type { ImageEditDraftContext } from '../draft-context.js';

/** FLUX 3 region actions: an edit needs an instruction; a removal may describe what fills the space. */
export const FLUX_3_REGION_MODES: ImageEditRegionModeRule[] = [
  { mode: 'edit', requiresInstruction: true },
  { mode: 'remove', requiresInstruction: false },
];

const flux3DraftSchema = z.object({
  panel: z.literal('flux-3'),
  baseAssetFileId: imageEditIdentity,
  wholeImageInstruction: z.string().max(4000),
  styleReferenceAssetFileId: imageEditIdentity.nullable(),
  regions: z.array(z.object({
    number: z.number().int(),
    mode: z.enum(['edit', 'remove']),
    box: imageEditRegionBoxSchema,
    instruction: z.string().max(2000),
  }).strict()).max(50),
  resolution: imageEditResolutionSchema,
}).strict();

export function validateFlux3Draft(draft: unknown, context: ImageEditDraftContext): Flux3ImageEditDraft {
  const parsed = flux3DraftSchema.safeParse(draft);
  if (!parsed.success) {
    assertNoImageEditIssues(parsed.error.issues.map((issue) => imageEditIssue(['draft', ...issue.path.map(String)], issue.message)), 'The panel draft is invalid.');
  }
  const value = parsed.data!;
  assertNoImageEditIssues([
    ...(value.baseAssetFileId === context.editBaseAssetFileId ? [] : [imageEditIssue(['draft', 'baseAssetFileId'], 'The image to edit changed. Generate again from the current version.')]),
    ...(value.styleReferenceAssetFileId === null || context.styleReferenceAssetFileIds.includes(value.styleReferenceAssetFileId)
      ? []
      : [imageEditIssue(['draft', 'styleReferenceAssetFileId'], 'The selected style reference is not an available Production or Storyboard Lookbook sheet. Choose an available sheet or clear the style reference.')]),
    ...(value.regions.length > 0 || value.wholeImageInstruction.trim() ? [] : [imageEditIssue(['draft'], 'Describe a change or mark a region.')]),
    ...imageEditRegionIssues(value.regions, FLUX_3_REGION_MODES, ['draft', 'regions']),
  ], 'The panel draft is invalid.');
  return value;
}
