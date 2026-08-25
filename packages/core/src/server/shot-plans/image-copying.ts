import { createAssetMembership } from '../assets/ownership.js';
import { readOwnedAsset } from '../assets/projection.js';
import { selectAssetInSession } from '../assets/selection.js';
import { assetSelectionTargetKey } from '../assets/selection-targets.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import { insertAssetRecord } from '../database/access/assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import {
  persistProjectAssetFileSync,
  type ProjectAssetFileWriteSet,
} from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function copySelectedShotImage(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  sourceShotId: string;
  destinationShotId: string;
  destinationShotPlanId: string;
  ids: (prefix: Parameters<ProjectIdGenerator['next']>[0]) => string;
  now: string;
}): void {
  const sourceOwner = { kind: 'shot' as const, id: input.sourceShotId };
  const selectedAssetId = readSelectedAssetRecord(
    input.session,
    assetSelectionTargetKey(sourceOwner)
  )?.assetId;
  if (!selectedAssetId) {
    return;
  }
  const source = readOwnedAsset(input.session, {
    owner: sourceOwner,
    assetId: selectedAssetId,
  });
  if (!source || source.type !== 'shot_image' || source.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_SHOT_IMAGE_INVALID',
      `Shot ${input.sourceShotId} has an invalid selected image.`
    );
  }
  const assetId = input.ids('asset');
  insertAssetRecord(input.session, {
    id: assetId,
    localeId: source.localeId,
    type: source.type,
    mediaKind: source.mediaKind,
    title: source.title,
    oneLineSummary: source.oneLineSummary ?? undefined,
    referenceName: source.referenceName,
    tags: source.tags,
    origin: source.origin,
    availability: source.availability,
    generationProvenance: source.generationProvenance,
    authoredFromShotPlanId: source.authoredFrom?.id ?? null,
    createdAt: input.now,
    updatedAt: input.now,
  });
  createAssetMembership(input.session, {
    assetId,
    owner: { kind: 'shot', id: input.destinationShotId },
    now: input.now,
  });
  for (const sourceFile of source.files) {
    persistProjectAssetFileSync({
      session: input.session,
      projectFolder: input.projectFolder,
      writeSet: input.writeSet,
      assetId,
      assetFileId: input.ids('asset_file'),
      sourceProjectRelativePath: sourceFile.projectRelativePath,
      destination: {
        kind: 'shot.image',
        shotPlanId: input.destinationShotPlanId,
        shotId: input.destinationShotId,
      },
      namingMode: source.origin === 'generated'
        ? { kind: 'generated' }
        : { kind: 'external' },
      fileRole: sourceFile.role,
      mediaKind: 'image',
      mimeType: sourceFile.mimeType ?? undefined,
      width: sourceFile.width ?? undefined,
      height: sourceFile.height ?? undefined,
      durationSeconds: sourceFile.durationSeconds ?? undefined,
      now: input.now,
    });
  }
  selectAssetInSession(input.session, {
    target: { kind: 'shot', id: input.destinationShotId },
    assetId,
    now: input.now,
  });
}
