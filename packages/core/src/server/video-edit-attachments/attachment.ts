import type { AssetMetadataInput } from '../../client/assets.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { normalizeAssetMetadata } from '../assets/metadata.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { persistGeneratedMediaAttachment } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import { videoEditResourceKeys } from './resource-keys.js';
import { readVideoEditSource } from './source.js';

export function attachVideoEditMedia(input: {
  purpose: 'video.edit';
  target: { kind: 'asset'; id: string };
  sourceProjectRelativePath: string;
  title?: string;
  assetMetadata?: AssetMetadataInput;
  generationProvenance: MediaGenerationProvenance;
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
}) {
  const source = readVideoEditSource({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.target.id,
    generationProvenance: input.generationProvenance,
  });
  const resourceKeys = videoEditResourceKeys({
    source: source.asset,
    session: input.session,
  });
  const metadata = normalizeAssetMetadata({
    oneLineSummary: input.assetMetadata?.oneLineSummary === undefined
      ? source.asset.oneLineSummary
      : input.assetMetadata.oneLineSummary,
    referenceName: input.assetMetadata?.referenceName === undefined
      ? source.asset.referenceName
      : input.assetMetadata.referenceName,
    tags: input.assetMetadata?.tags === undefined
      ? source.asset.tags
      : input.assetMetadata.tags,
  });
  const persisted = persistGeneratedMediaAttachment({
    previsRevisionId: source.asset.authoredFrom?.previsRevisionId,
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
    now: new Date().toISOString(),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: {
      file: {
        kind: 'asset.videoEdit',
        sourceAssetId: source.asset.id,
        sourceAssetFileId: source.file.id,
      },
      owner: source.asset.owner,
      resourceKeys,
    },
    asset: {
      localeId: source.asset.localeId,
      type: source.asset.type,
      mediaKind: 'video',
      title: input.title?.trim() || source.asset.title,
      ...metadata,
      origin: 'generated',
    },
    fileRole: 'primary',
    generationProvenance: input.generationProvenance,
    ...(source.asset.authoredFrom
      ? { authoredFromShotPlanId: source.asset.authoredFrom.id }
      : {}),
  });
  const asset = readOwnedAsset(input.session, {
    owner: source.asset.owner,
    assetId: persisted.assetId,
  });
  const project = readProjectRecord(input.session);
  if (!asset || !project) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Edited video attachment was not persisted.',
    );
  }
  return {
    valid: true as const,
    purpose: input.purpose,
    target: input.target,
    asset,
    generationProvenance: input.generationProvenance,
    resourceKeys,
    project: {
      projectName: project.projectName,
      id: project.id,
      projectFolder: input.projectFolder,
    },
  };
}
