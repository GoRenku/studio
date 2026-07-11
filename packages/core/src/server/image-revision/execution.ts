import type {
  ImageRevisionRunReport,
  MediaGenerationRun,
} from '../../client/index.js';
import { recordAssetFileGenerationProvenance } from '../asset-file-generation/commands.js';
import {
  createMediaGenerationSpec,
} from '../media-generation/lifecycle/spec-service.js';
import { runMediaGenerationSpec } from '../media-generation/lifecycle/run-service.js';
import { withMediaGenerationProjectSession } from '../media-generation/lifecycle/project-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RunImageRevisionInput } from './contracts.js';
import { requireImageRevisionDestination } from './destination-registry.js';
import { buildRevisionSpec } from './service.js';
import { resolveImageRevisionSource } from './source-context.js';

export async function runImageRevision(
  input: RunImageRevisionInput,
): Promise<ImageRevisionRunReport> {
  if (input.approveLiveProviderRun !== true) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_LIVE_APPROVAL_REQUIRED',
      'Image Revision requires explicit approval for a live provider run.',
    );
  }
  const source = await withMediaGenerationProjectSession(input, ({ session }) =>
    resolveImageRevisionSource(session, input.target),
  );
  const spec = await buildRevisionSpec(input, source);
  const specRecord = await createMediaGenerationSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec,
    idGenerator: input.idGenerator,
  });
  const runReport = await runMediaGenerationSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: specRecord.id,
    approveLiveProviderRun: true,
    idGenerator: input.idGenerator,
  });
  const outputProjectRelativePath = requireSingleImageOutput(runReport.run);
  const destination = requireImageRevisionDestination(input.target.kind);
  let imported;
  try {
    imported = await destination.importResult({
      projectName: input.projectName,
      homeDir: input.homeDir,
      target: input.target,
      source,
      run: runReport.run,
      outputProjectRelativePath,
      idGenerator: input.idGenerator,
    });
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_IMPORT_FAILED',
      error instanceof Error ? error.message : String(error),
    );
  }
  await recordAssetFileGenerationProvenance({
    projectName: input.projectName,
    homeDir: input.homeDir,
    assetFileId: imported.imported.assetFileId,
    mediaGenerationRunId: runReport.run.id,
  });
  return {
    spec: specRecord,
    run: runReport.run,
    imported: imported.imported,
    resourceKeys: imported.resourceKeys,
  };
}

function requireSingleImageOutput(run: MediaGenerationRun): string {
  if (!Array.isArray(run.outputs) || run.outputs.length !== 1) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_OUTPUT_COUNT_UNSUPPORTED',
      'Image Revision requires exactly one generated output.',
    );
  }
  const output = run.outputs[0];
  if (!output || typeof output !== 'object') {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_OUTPUT_MISSING',
      'Image Revision did not produce an output.',
    );
  }
  const candidate = output as {
    mimeType?: unknown;
    projectRelativePath?: unknown;
  };
  if (
    typeof candidate.projectRelativePath !== 'string' ||
    !candidate.projectRelativePath
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_OUTPUT_MISSING',
      'Image Revision output has no project-relative path.',
    );
  }
  if (
    typeof candidate.mimeType === 'string' &&
    !candidate.mimeType.startsWith('image/')
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_OUTPUT_NOT_IMAGE',
      'Image Revision output is not an image.',
    );
  }
  return candidate.projectRelativePath;
}
