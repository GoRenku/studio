import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { nativeRequestControlList, nativeRequestValuesIssues } from '../native-request-controls/validation.js';
import type { ImageEditDraft, ImageEditRoute } from './contracts.js';
import { assertNoImageEditIssues, imageEditIssue } from './diagnostics.js';
import { imageEditRegionIssues } from './region-validation.js';
import { imageEditDraftSchema } from './schemas.js';

/** Session facts a Generate draft is validated against. */
export interface ImageEditDraftContext {
  route: ImageEditRoute;
  editBaseAssetFileId: string | null;
  styleReferenceAssetFileIds: string[];
}

/** Validates a panel draft against the session route, collecting every issue. Instructions stay opaque. */
export function validateImageEditDraft(input: unknown, context: ImageEditDraftContext): ImageEditDraft {
  const parsed = imageEditDraftSchema.safeParse(input);
  if (!parsed.success) {
    assertNoImageEditIssues(parsed.error.issues.map((issue) => imageEditIssue(['draft', ...issue.path.map(String)], issue.message)), 'The panel draft is invalid.');
  }
  const draft = parsed.data!;
  assertNoImageEditIssues([
    ...(draft.baseAssetFileId === context.editBaseAssetFileId ? [] : [imageEditIssue(['draft', 'baseAssetFileId'], 'The image to edit changed. Generate again from the current version.')]),
    ...styleReferenceIssues(draft, context),
    ...(draft.regions.length > 0 || draft.wholeImageInstruction.trim() ? [] : [imageEditIssue(['draft'], 'Describe a change or mark a region.')]),
    ...regionIssues(draft, context.route),
    ...valueIssues(draft, context.route),
  ], 'The panel draft is invalid.');
  return draft;
}

function styleReferenceIssues(draft: ImageEditDraft, context: ImageEditDraftContext): DiagnosticIssue[] {
  if (draft.styleReferenceAssetFileId === null) return [];
  if (!context.route.styleReference) return [imageEditIssue(['draft', 'styleReferenceAssetFileId'], `${context.route.label} takes no style reference.`)];
  return context.styleReferenceAssetFileIds.includes(draft.styleReferenceAssetFileId)
    ? []
    : [imageEditIssue(['draft', 'styleReferenceAssetFileId'], 'The selected style reference is not an available Production or Storyboard Lookbook sheet. Choose an available sheet or clear the style reference.')];
}

function regionIssues(draft: ImageEditDraft, route: ImageEditRoute): DiagnosticIssue[] {
  if (route.regionModes === null) {
    return draft.regions.length === 0 ? [] : [imageEditIssue(['draft', 'regions'], `${route.label} takes no regions; describe the change for the whole image.`)];
  }
  return imageEditRegionIssues(draft.regions, route.regionModes, ['draft', 'regions']);
}

/** Exactly the route's control keys, each valid. */
function valueIssues(draft: ImageEditDraft, route: ImageEditRoute): DiagnosticIssue[] {
  return [
    ...nativeRequestControlList(route.controls)
      .filter((control) => !Object.hasOwn(draft.values, control.key))
      .map((control) => imageEditIssue(['draft', 'values', control.key], `${control.label} needs a value.`)),
    ...nativeRequestValuesIssues(route.controls, draft.values, imageEditIssue, ['draft', 'values']),
  ];
}
