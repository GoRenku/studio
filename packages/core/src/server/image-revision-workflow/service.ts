import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  ImageRevisionDraft,
  ImageRevisionEditorContext,
  ImageRevisionEstimateReport,
  ImageRevisionRunReport,
  ImageRevisionTarget,
} from '../../client/image-revision-workflow.js';
import type { GenerationPreviewResourceData } from '../../client/generation-preview-resource.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { readGenerationPurpose } from '../generation/purposes.js';
import { estimateGeneration } from '../generation/estimates.js';
import { createGenerationSpec } from '../generation/specs.js';
import { runGeneration } from '../generation/runs.js';
import { createRandomIdGenerator, type ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  buildImageRevisionPreview,
  buildImageRevisionSpec,
  createImageRevisionModeDefinition,
} from './draft.js';
import { attachImageRevisionOutput } from './attachment.js';
import { resolveImageRevisionSource } from './source.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import { readProjectRecord } from '../database/access/project.js';

type ProjectInput = RenkuConfigPathOptions & { projectName?: string };

export async function readImageRevisionContext(input: ProjectInput & {
  target: ImageRevisionTarget;
}): Promise<ImageRevisionEditorContext> {
  return withGenerationProject(input, async ({ session, projectFolder }) => {
    const source = resolveImageRevisionSource(session, input.target);
    const edit = await createImageRevisionModeDefinition({
      mode: 'edit',
      source,
      session,
      projectFolder,
    });
    let regenerate: ImageRevisionEditorContext['regenerate'];
    try {
      const definition = await createImageRevisionModeDefinition({
        mode: 'regenerate',
        source,
        session,
        projectFolder,
      });
      regenerate = {
        state: 'available',
        mode: 'regenerate',
        draft: definition.draft,
        preview: definition.preview,
        controls: definition.controls,
        diagnostics: [],
      };
    } catch (error) {
      regenerate = unavailableRegeneration(error);
    }
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
        draft: edit.draft,
        preview: edit.preview,
        controls: edit.controls,
        diagnostics: [],
      },
    };
  });
}

export async function previewImageRevisionDraft(input: ProjectInput & {
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
}): Promise<GenerationPreviewResourceData> {
  return withGenerationProject(input, async ({ session, projectFolder }) => {
    const source = resolveImageRevisionSource(session, input.target);
    const spec = await buildImageRevisionSpec({
      source,
      draft: input.draft,
      session,
      projectFolder,
    });
    return buildImageRevisionPreview({ spec, session, projectFolder });
  });
}

export async function estimateImageRevisionDraft(input: ProjectInput & {
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
}): Promise<ImageRevisionEstimateReport> {
  return withGenerationProject(input, async ({ session, projectFolder }) => {
    const source = resolveImageRevisionSource(session, input.target);
    const spec = await buildImageRevisionSpec({
      source,
      draft: input.draft,
      session,
      projectFolder,
    });
    const purpose = readGenerationPurpose(spec.purpose);
    const [preview, estimate] = await Promise.all([
      buildImageRevisionPreview({ spec, session, projectFolder }),
      estimateGeneration({ spec, purpose }),
    ]);
    return {
      preview: estimate.valid
        ? {
            ...preview,
            estimate: {
              state: 'estimated',
              estimatedCostUsd: estimate.estimate.estimatedCostUsd,
            },
          }
        : preview,
      estimatedUsd: estimate.valid ? estimate.estimate.estimatedCostUsd : null,
      diagnostics: estimate.valid ? [] : estimate.diagnostics,
    };
  });
}

export async function runImageRevision(input: ProjectInput & {
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
  approveLiveProviderRun: true;
  idGenerator?: ProjectIdGenerator;
}): Promise<ImageRevisionRunReport> {
  if (input.approveLiveProviderRun !== true) {
    throw new ProjectDataError(
      'CORE_GENERATION_LIVE_APPROVAL_REQUIRED',
      'Image Revision requires explicit approval for a live provider run.'
    );
  }
  return withGenerationProject(input, async ({ session, projectFolder }) => {
    const source = resolveImageRevisionSource(session, input.target);
    const spec = await buildImageRevisionSpec({
      source,
      draft: input.draft,
      session,
      projectFolder,
    });
    const purpose = readGenerationPurpose(spec.purpose);
    const estimate = await estimateGeneration({ spec, purpose });
    if (!estimate.valid) {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_ESTIMATE_INVALID',
        'Image Revision cannot run until the exact request can be estimated.',
        { issues: estimate.diagnostics }
      );
    }
    const ids = input.idGenerator ?? createRandomIdGenerator();
    const now = new Date().toISOString();
    const record = createGenerationSpec({
      id: ids.next('media_generation_spec'),
      spec,
      purpose,
      session,
      now,
    });
    const run = await runGeneration({
      id: ids.next('media_generation_run'),
      specRecord: record,
      purpose,
      projectAspectRatio: effectiveProjectAspectRatio(readProjectRecord(session)?.aspectRatio),
      approvalToken: estimate.estimate.approvalToken,
      mode: 'live',
      session,
      projectFolder,
      now,
    });
    if (!run.valid || run.run.status !== 'completed') {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_RUN_FAILED',
        'Image Revision generation did not complete.',
        { issues: run.valid ? run.run.diagnostics : run.diagnostics }
      );
    }
    const output = run.run.outputs.find((candidate) =>
      candidate.projectRelativePath && (!candidate.mimeType || candidate.mimeType.startsWith('image/'))
    );
    if (!output?.projectRelativePath) {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_OUTPUT_MISSING',
        'Image Revision did not produce an image output.'
      );
    }
    const attached = attachImageRevisionOutput({
      session,
      projectFolder,
      target: input.target,
      source,
      run: run.run,
      sourceProjectRelativePath: output.projectRelativePath,
      idGenerator: ids,
      now,
    });
    return {
      spec: record,
      run: run.run,
      imported: attached.imported,
      resourceKeys: attached.resourceKeys,
    };
  });
}

function unavailableRegeneration(error: unknown): ImageRevisionEditorContext['regenerate'] {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostic: DiagnosticIssue = createDiagnosticWarning(
    'CORE_IMAGE_REVISION_REGENERATE_UNAVAILABLE',
    message,
    { path: ['regenerate'] },
    'Use Edit to revise this image.'
  );
  return {
    state: 'unavailable',
    mode: 'regenerate',
    diagnostics: [diagnostic],
  };
}
