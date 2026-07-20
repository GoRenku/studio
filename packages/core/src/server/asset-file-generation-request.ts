import type { GenerationPreviewResourceData } from '../client/generation-preview-resource.js';
import { readAssetFileGenerationRecord } from './database/access/asset-file-generations.js';
import { readAssetFileRecordIncludingDiscarded } from './database/access/asset-files.js';
import { readAssetRecord } from './database/access/assets.js';
import {
  readGenerationRunRecord,
  readGenerationSpecRecord,
} from './database/access/media-generation.js';
import type { DatabaseSession } from './database/lifecycle/store.js';
import { buildGenerationPreview } from './generation/previews.js';
import { withGenerationProject } from './generation/project-operation.js';
import { readGenerationPurpose } from './generation/purposes.js';
import { resolveGenerationReferenceProjectFile } from './generation/references.js';
import { projectGenerationPreviewResource } from './generation-preview-resource/projection.js';
import { ProjectDataError } from './project-data-error.js';
import type { RenkuConfigPathOptions } from './renku-config.js';

export interface ReadAssetFileGenerationRequestInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  assetId: string;
  assetFileId: string;
}

export async function readAssetFileGenerationRequest(
  input: ReadAssetFileGenerationRequestInput,
): Promise<GenerationPreviewResourceData> {
  return withGenerationProject(input, ({ session, projectFolder }) =>
    readAssetFileGenerationRequestInSession({
      session,
      projectFolder,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    })
  );
}

export async function readGenerationReferenceProjectFile(
  input: RenkuConfigPathOptions & {
    projectName?: string;
    projectRelativePath: string;
  },
) {
  return withGenerationProject(input, ({ projectFolder }) =>
    resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath: input.projectRelativePath,
    })
  );
}

async function readAssetFileGenerationRequestInSession(input: {
  session: DatabaseSession;
  projectFolder: string;
  assetId: string;
  assetFileId: string;
}): Promise<GenerationPreviewResourceData> {
  const asset = readAssetRecord(input.session, input.assetId);
  const file = readAssetFileRecordIncludingDiscarded(input.session, {
    assetId: input.assetId,
    assetFileId: input.assetFileId,
  });
  if (!asset || asset.discardedAt || !file || file.discardedAt) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_REQUEST_SOURCE_INVALID',
      'The generation request source must be an active exact AssetFile.'
    );
  }

  const managed = readAssetFileGenerationRecord(input.session, file.id);
  const managedRunId = managed?.mediaGenerationRunId ?? null;
  const externalSpecId = file.sourceGenerationSpecId;
  if (managedRunId && externalSpecId) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_CONFLICT',
      'The AssetFile has conflicting managed and external generation provenance.'
    );
  }
  if (!managedRunId && !externalSpecId) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_MISSING',
      'The AssetFile does not have a saved generation request.'
    );
  }

  if (managedRunId) {
    const run = readGenerationRunRecord(input.session, managedRunId);
    if (!run) {
      throw new ProjectDataError(
        'CORE_ASSET_FILE_GENERATION_REQUEST_RUN_MISSING',
        'The AssetFile generation run could not be found.'
      );
    }
    return projectSavedRequest({
      session: input.session,
      projectFolder: input.projectFolder,
      spec: run.specSnapshot,
    });
  }

  const record = readGenerationSpecRecord(input.session, externalSpecId!);
  if (!record || record.spec.executionKind !== 'agent-external') {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_REQUEST_SOURCE_SPEC_INVALID',
      'The AssetFile external source spec could not be found.'
    );
  }
  if (record.frozenAt === null) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_REQUEST_SOURCE_SPEC_MUTABLE',
      'The AssetFile external source spec must be frozen.'
    );
  }
  return projectSavedRequest({
    session: input.session,
    projectFolder: input.projectFolder,
    spec: record.spec,
  });
}

async function projectSavedRequest(input: {
  session: DatabaseSession;
  projectFolder: string;
  spec: import('../client/generation.js').GenerationSpec;
}): Promise<GenerationPreviewResourceData> {
  const purpose = readGenerationPurpose(input.spec.purpose);
  const context = await purpose.buildContext({
    target: input.spec.target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const preview = await buildGenerationPreview({
    spec: input.spec,
    referenceGuide: context.referenceGuide,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  return projectGenerationPreviewResource({
    preview: {
      ...preview,
      settings: context.settings,
      models: [],
    },
    session: input.session,
  });
}
