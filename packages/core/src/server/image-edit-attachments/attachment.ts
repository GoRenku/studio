import type { AssetMetadataInput } from '../../client/assets.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { normalizeAssetMetadata } from '../assets/metadata.js';
import { readOwnedAsset } from '../assets/projection.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { persistGeneratedMediaAttachment } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveImageEditContinuation } from './continuation-registry.js';
import { readImageEditSource } from './source.js';

export function attachImageEditMedia(input: {
  purpose: 'image.edit';
  target: { kind: 'asset'; id: string };
  sourceProjectRelativePath: string;
  title?: string;
  assetMetadata?: AssetMetadataInput;
  generationProvenance: MediaGenerationProvenance;
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
}) {
  const source = readImageEditSource({
    session: input.session,
    assetId: input.target.id,
    generationProvenance: input.generationProvenance,
  });
  const continuation = resolveImageEditContinuation({
    source,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const metadata = normalizeAssetMetadata({
    oneLineSummary: input.assetMetadata?.oneLineSummary === undefined
      ? source.oneLineSummary
      : input.assetMetadata.oneLineSummary,
    referenceName: input.assetMetadata?.referenceName === undefined
      ? source.referenceName
      : input.assetMetadata.referenceName,
    tags: input.assetMetadata?.tags === undefined ? source.tags : input.assetMetadata.tags,
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
    asset: {
      type: continuation.assetType,
      mediaKind: 'image',
      title: input.title?.trim() || source.title,
      ...metadata,
      origin: 'generated',
    },
    fileRole: continuation.fileRole,
    generationProvenance: input.generationProvenance,
    ...(continuation.authoredFromShotPlanId
      ? { authoredFromShotPlanId: continuation.authoredFromShotPlanId }
      : {}),
  });
  const asset = readOwnedAsset(input.session, {
    owner: continuation.owner,
    assetId: persisted.assetId,
  });
  const project = readProjectRecord(input.session);
  if (!asset || !project) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Edited image attachment was not persisted.',
    );
  }
  return {
    valid: true as const,
    purpose: input.purpose,
    target: input.target,
    asset,
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
