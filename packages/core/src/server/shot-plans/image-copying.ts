import { eq } from 'drizzle-orm';
import { assetFileGenerations } from '../schema/index.js';
import { createAssetMembership } from '../assets/ownership.js';
import { readOwnedAsset } from '../assets/projection.js';
import { selectAssetInSession } from '../assets/selection.js';
import { assetOwnerKey } from '../assets/owner-keys.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  readAssetFileRecordIncludingDiscarded,
  setAssetFileSourceGenerationSpec,
} from '../database/access/asset-files.js';
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
    assetOwnerKey(sourceOwner)
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
    purpose: source.purpose,
    origin: source.origin,
    availability: source.availability,
    createdAt: input.now,
    updatedAt: input.now,
  });
  createAssetMembership(input.session, {
    assetId,
    owner: { kind: 'shot', id: input.destinationShotId },
    now: input.now,
  });
  for (const sourceFile of source.files) {
    const assetFileId = input.ids('asset_file');
    persistProjectAssetFileSync({
      session: input.session,
      projectFolder: input.projectFolder,
      writeSet: input.writeSet,
      assetId,
      assetFileId,
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
    copyAssetFileProvenance(input.session, {
      sourceAssetId: source.id,
      sourceAssetFileId: sourceFile.id,
      destinationAssetFileId: assetFileId,
      now: input.now,
    });
  }
  selectAssetInSession(input.session, {
    target: { kind: 'shot', id: input.destinationShotId },
    assetId,
    now: input.now,
  });
}

function copyAssetFileProvenance(
  session: DatabaseSession,
  input: {
    sourceAssetId: string;
    sourceAssetFileId: string;
    destinationAssetFileId: string;
    now: string;
  }
): void {
  const sourceFile = readAssetFileRecordIncludingDiscarded(session, {
    assetId: input.sourceAssetId,
    assetFileId: input.sourceAssetFileId,
  });
  if (!sourceFile) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_STORAGE_INVALID',
      `Selected Shot image file is missing: ${input.sourceAssetFileId}.`
    );
  }
  if (sourceFile.sourceGenerationSpecId) {
    setAssetFileSourceGenerationSpec(session, {
      assetFileId: input.destinationAssetFileId,
      sourceGenerationSpecId: sourceFile.sourceGenerationSpecId,
    });
  }
  const generation = session.db.select().from(assetFileGenerations)
    .where(eq(assetFileGenerations.assetFileId, input.sourceAssetFileId))
    .get();
  if (generation) {
    session.db.insert(assetFileGenerations).values({
      assetFileId: input.destinationAssetFileId,
      mediaGenerationRunId: generation.mediaGenerationRunId,
      outputArtifactId: generation.outputArtifactId,
      createdAt: input.now,
    }).run();
  }
}
