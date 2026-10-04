import type { AssetFileMetadataInput } from '../../client/asset-files.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { normalizeAssetFileMetadata } from '../asset-files/metadata.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { persistGeneratedMediaAttachment } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import { videoEditResourceKeys } from './resource-keys.js';
import { readVideoEditSource } from './source.js';

export function attachVideoEditMedia(input: {
  purpose: 'video.edit';
  target: { kind: 'assetFile'; assetFileId: string };
  sourceProjectRelativePath: string;
  title?: string;
  assetFileMetadata?: AssetFileMetadataInput;
  generationProvenance: MediaGenerationProvenance;
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
}) {
  const source = readVideoEditSource({
    session: input.session,
    projectFolder: input.projectFolder,
    assetFileId: input.target.assetFileId,
    generationProvenance: input.generationProvenance,
  });
  const resourceKeys = videoEditResourceKeys({
    source: source,
    session: input.session,
  });
  const metadata = normalizeAssetFileMetadata({
    oneLineSummary: input.assetFileMetadata?.oneLineSummary === undefined
      ? source.oneLineSummary
      : input.assetFileMetadata.oneLineSummary,
    referenceName: input.assetFileMetadata?.referenceName === undefined
      ? source.referenceName
      : input.assetFileMetadata.referenceName,
    tags: input.assetFileMetadata?.tags === undefined
      ? source.tags
      : input.assetFileMetadata.tags,
  });
  const persisted = persistGeneratedMediaAttachment({
    previsRevisionId: source.authoredFrom?.previsRevisionId,
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
    now: new Date().toISOString(),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: {
      file: {
        kind: 'assetFile.videoEdit',
        sourceAssetFileId: source.id,
      },
      owner: source.owner,
      resourceKeys,
    },
    assetFileMetadata: {
      localeId: source.localeId,
      type: source.type,
      mediaKind: 'video',
      title: input.title?.trim() || source.title,
      ...metadata,
      origin: 'generated',
    },
    generationProvenance: input.generationProvenance,
    ...(source.authoredFrom
      ? { authoredFromShotPlanId: source.authoredFrom.id }
      : {}),
  });
  const assetFile = readOwnedAssetFile(input.session, {
    owner: source.owner,
    assetFileId: persisted.assetFileId,
  });
  const project = readProjectRecord(input.session);
  if (!assetFile || !project) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Edited video attachment was not persisted.',
    );
  }
  return {
    valid: true as const,
    purpose: input.purpose,
    target: input.target,
    assetFile,
    generationProvenance: input.generationProvenance,
    resourceKeys,
    project: {
      projectName: project.projectName,
      id: project.id,
      projectFolder: input.projectFolder,
    },
  };
}
