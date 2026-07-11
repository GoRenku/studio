import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GenerationEditorControl,
  GenerationPreviewRequest,
  ImageRevisionDraft,
  ImageRevisionEditorContext,
  ImageRevisionEstimateReport,
  MediaGenerationSpec,
} from '../../client/index.js';
import {
  buildDraftMediaGenerationPreview,
} from '../generation-preview/service.js';
import { estimateDraftMediaGenerationSpec } from '../media-generation/cost/spec-estimates.js';
import {
  buildImageEditContext,
  listImageEditModels,
} from '../media-generation/purposes/image-edit.js';
import { withMediaGenerationProjectSession } from '../media-generation/lifecycle/project-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  EstimateImageRevisionDraftInput,
  PreviewImageRevisionDraftInput,
  ReadImageRevisionContextInput,
} from './contracts.js';
import { createEditDraft, applyEditDraft } from './edit-draft.js';
import { singleOutputControls } from './editor-controls.js';
import {
  createRegenerateDraft,
} from './regenerate-draft.js';
import { requireMediaGenerationPurposeDefinition } from '../media-generation/lifecycle/purpose-lifecycle-registry.js';
import {
  resolveImageRevisionSource,
  type ResolvedImageRevisionSource,
} from './source-context.js';

export async function readImageRevisionContext(
  input: ReadImageRevisionContextInput,
): Promise<ImageRevisionEditorContext> {
  const source = await readSource(input);
  const editDefinition = await readEditDefinition(input, source);
  const regenerate = await readRegenerateContext(input, source);
  return {
    target: input.target,
    source: {
      title: source.asset.title,
      assetId: source.asset.id,
      assetFileId: source.file.id,
    },
    regenerate,
    edit: {
      state: 'available',
      mode: 'edit',
      draft: editDefinition.draft,
      preview: null,
      controls: editDefinition.controls,
      diagnostics: [],
    },
  };
}

export async function previewImageRevisionDraft(
  input: PreviewImageRevisionDraftInput,
): Promise<GenerationPreviewRequest> {
  const source = await readSource(input);
  const spec = await buildRevisionSpec(input, source);
  return buildDraftMediaGenerationPreview({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec,
  });
}

export async function estimateImageRevisionDraft(
  input: EstimateImageRevisionDraftInput,
): Promise<ImageRevisionEstimateReport> {
  const source = await readSource(input);
  const spec = await buildRevisionSpec(input, source);
  const [preview, estimateReport] = await Promise.all([
    buildDraftMediaGenerationPreview({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec,
    }),
    estimateDraftMediaGenerationSpec({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec,
    }),
  ]);
  return {
    preview,
    estimatedUsd:
      estimateReport.estimate.state === 'priced'
        ? estimateReport.estimate.estimatedCostUsd
        : null,
    diagnostics: [],
  };
}

export async function buildRevisionSpec(
  input: PreviewImageRevisionDraftInput,
  resolvedSource?: ResolvedImageRevisionSource,
): Promise<MediaGenerationSpec> {
  const source = resolvedSource ?? await readSource(input);
  if (input.draft.mode === 'regenerate') {
    if (!source.generationRun) {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_REGENERATE_PROVENANCE_REQUIRED',
        'Regenerate requires exact Media Generation provenance for the source AssetFile.',
      );
    }
    assertRegenerateOwnerBinding(source);
    const regeneration = requireMediaGenerationPurposeDefinition(
      source.generationRun.purpose,
    ).imageRegeneration;
    if (!regeneration) {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_REGENERATE_PURPOSE_UNSUPPORTED',
        `Media generation purpose cannot be regenerated from Image Revision: ${source.generationRun.purpose}.`,
      );
    }
    return regeneration.applyEditor({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: source.generationRun.specSnapshot,
      draft: input.draft,
    });
  }
  if (input.draft.mode === 'edit') {
    const definition = await readEditDefinition(input, source);
    return applyEditDraft({
      assetId: source.asset.id,
      assetFileId: source.file.id,
      draft: input.draft,
      controls: definition.controls,
    });
  }
  throw new ProjectDataError(
    'CORE_IMAGE_REVISION_DRAFT_INVALID',
    'Image Revision mode is invalid.',
  );
}

async function readRegenerateContext(
  input: ReadImageRevisionContextInput,
  source: ResolvedImageRevisionSource,
): Promise<ImageRevisionEditorContext['regenerate']> {
  const run = source.generationRun;
  if (!run) {
    return unavailable(
      'CORE_IMAGE_REVISION_REGENERATE_PROVENANCE_REQUIRED',
      'Regenerate is unavailable because this image has no exact generation provenance.',
      'Use Edit to revise the image, or regenerate an image imported with a completed Renku generation receipt.',
    );
  }
  const regeneration = requireMediaGenerationPurposeDefinition(
    run.purpose,
  ).imageRegeneration;
  if (!regeneration) {
    return unavailable(
      'CORE_IMAGE_REVISION_REGENERATE_PURPOSE_UNSUPPORTED',
      `Regenerate is unavailable for generation purpose ${run.purpose}.`,
    );
  }
  try {
    assertRegenerateOwnerBinding(source);
    const initialDraft: ImageRevisionDraft = {
      mode: 'regenerate',
      authoredText:
        'prompt' in run.specSnapshot &&
        typeof run.specSnapshot.prompt === 'string'
          ? run.specSnapshot.prompt
          : '',
      referenceSelections: [],
      generationControls: [],
    };
    const initialSpec = await regeneration.applyEditor({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: run.specSnapshot,
      draft: initialDraft,
    });
    const preview = await buildDraftMediaGenerationPreview({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: initialSpec,
    });
    return {
      state: 'available',
      mode: 'regenerate',
      draft: createRegenerateDraft(run.specSnapshot, preview),
      preview,
      controls: singleOutputControls(),
      diagnostics: [],
    };
  } catch (error) {
    return unavailable(
      'CORE_IMAGE_REVISION_REGENERATE_PURPOSE_UNSUPPORTED',
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function readEditDefinition(
  input: ReadImageRevisionContextInput,
  source: ResolvedImageRevisionSource,
): Promise<{ draft: ImageRevisionDraft; controls: GenerationEditorControl[] }> {
  const [context, models] = await Promise.all([
    buildImageEditContext({
      projectName: input.projectName,
      homeDir: input.homeDir,
      assetId: source.asset.id,
    }),
    listImageEditModels({
      projectName: input.projectName,
      homeDir: input.homeDir,
      assetId: source.asset.id,
    }),
  ]);
  return createEditDraft({
    assetId: source.asset.id,
    assetFileId: source.file.id,
    models,
    recommendedModelChoice: context.recommendedModelChoice,
  });
}

async function readSource(
  input: ReadImageRevisionContextInput,
): Promise<ResolvedImageRevisionSource> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    resolveImageRevisionSource(session, input.target),
  );
}

function assertRegenerateOwnerBinding(source: ResolvedImageRevisionSource): void {
  const spec = source.generationRun?.specSnapshot;
  if (!spec) {
    return;
  }
  const target = source.target;
  const matches =
    (target.kind === 'castCharacterSheet' &&
      spec.purpose === 'cast.character-sheet' &&
      spec.target.kind === 'castMember' &&
      spec.target.id === target.castMemberId) ||
    (target.kind === 'locationEnvironmentSheet' &&
      spec.purpose === 'location.environment-sheet' &&
      spec.target.kind === 'location' &&
      spec.target.id === target.locationId) ||
    (target.kind === 'lookbookImage' &&
      spec.purpose === 'lookbook.image' &&
      spec.target.kind === 'lookbook' &&
      spec.target.id === target.lookbookId) ||
    (target.kind === 'lookbookSheet' &&
      spec.purpose === 'lookbook.sheet' &&
      spec.target.kind === 'lookbook' &&
      spec.target.id === target.lookbookId) ||
    target.kind === 'shotVideoTakeInput';
  if (!matches) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_OWNER_MISMATCH',
      'The source generation target does not match the current image owner.',
    );
  }
}

function unavailable(
  code: string,
  message: string,
  suggestion?: string,
): ImageRevisionEditorContext['regenerate'] {
  const issue: DiagnosticIssue = {
    code,
    message,
    severity: 'warning',
    location: { path: ['regenerate'] },
    ...(suggestion ? { suggestion } : {}),
  };
  return {
    state: 'unavailable',
    mode: 'regenerate',
    diagnostics: [issue],
  };
}
