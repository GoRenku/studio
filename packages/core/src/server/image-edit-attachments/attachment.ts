import type { AssetFileMetadataInput } from '../../client/asset-files.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { normalizeAssetFileMetadata } from '../asset-files/metadata.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { persistGeneratedMediaAttachment } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveImageEditContinuation } from './continuation-registry.js';
import { readImageEditSource } from './source.js';

export function attachImageEditMedia(input: {
  purpose: 'image.edit';
  target: { kind: 'assetFile'; assetFileId: string };
  sourceProjectRelativePath: string;
  title?: string;
  assetFileMetadata?: AssetFileMetadataInput;
  generationProvenance: MediaGenerationProvenance;
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
}) {
  const source = readImageEditSource({
    session: input.session,
    assetFileId: input.target.assetFileId,
    generationProvenance: input.generationProvenance,
  });
  const continuation = resolveImageEditContinuation({
    source,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const metadata = normalizeAssetFileMetadata({
    oneLineSummary: input.assetFileMetadata?.oneLineSummary === undefined
      ? source.oneLineSummary
      : input.assetFileMetadata.oneLineSummary,
    referenceName: input.assetFileMetadata?.referenceName === undefined
      ? source.referenceName
      : input.assetFileMetadata.referenceName,
    tags: input.assetFileMetadata?.tags === undefined ? source.tags : input.assetFileMetadata.tags,
  });
  const persisted = persistGeneratedMediaAttachment({
    previsRevisionId: source.authoredFrom?.previsRevisionId,
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
    now: new Date().toISOString(),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: {
      file: continuation.destination,
      owner: continuation.owner,
      resourceKeys: continuation.resourceKeys,
    },
    assetFileMetadata: {
      localeId: source.localeId,
      type: continuation.assetFileType,
      mediaKind: 'image',
      title: input.title?.trim() || source.title,
      ...metadata,
      origin: 'generated',
    },
    generationProvenance: input.generationProvenance,
    ...(continuation.authoredFromShotPlanId
      ? { authoredFromShotPlanId: continuation.authoredFromShotPlanId }
      : {}),
  });
  const assetFile = readOwnedAssetFile(input.session, {
    owner: continuation.owner,
    assetFileId: persisted.assetFileId,
  });
  const project = readProjectRecord(input.session);
  if (!assetFile || !project) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Edited image attachment was not persisted.',
    );
  }
  return {
    valid: true as const,
    purpose: input.purpose,
    target: input.target,
    assetFile,
    generationProvenance: input.generationProvenance,
    resourceKeys: continuation.resourceKeys,
    project: {
      projectName: project.projectName,
      id: project.id,
      projectFolder: input.projectFolder,
    },
    ...(persisted.ownerRecord ? { ownerRecord: persisted.ownerRecord } : {}),
  };
}
