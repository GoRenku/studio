import { readOwnedAssetFile } from '../asset-files/projection.js';
import { selectAssetFileInSession } from '../asset-files/selection.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
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
  const selectedAssetFileId = readSelectedAssetFileRecord(
    input.session,
    assetFileSelectionTargetKey(sourceOwner)
  )?.assetFileId;
  if (!selectedAssetFileId) {
    return;
  }
  const source = readOwnedAssetFile(input.session, {
    owner: sourceOwner,
    assetFileId: selectedAssetFileId,
  });
  if (!source || source.type !== 'shot_image' || source.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_SHOT_IMAGE_INVALID',
      `Shot ${input.sourceShotId} has an invalid selected image.`
    );
  }
  const assetFileId = input.ids('asset_file');
    persistProjectAssetFileSync({
      owner: { kind: 'shot', id: input.destinationShotId },
      assetFileMetadata: {
        localeId: source.localeId,
        type: source.type,
        title: source.title,
        oneLineSummary: source.oneLineSummary ?? undefined,
        referenceName: source.referenceName,
        tags: source.tags,
        origin: source.origin,
        generationProvenance: source.generationProvenance,
        authoredFromShotPlanId: source.authoredFrom?.id ?? null
      },
      session: input.session,
      projectFolder: input.projectFolder,
      writeSet: input.writeSet,
      assetFileId,
      sourceProjectRelativePath: source.projectRelativePath,
      destination: {
        kind: 'shot.image',
        shotPlanId: input.destinationShotPlanId,
        shotId: input.destinationShotId,
      },
      namingMode: source.origin === 'generated'
        ? { kind: 'generated' }
        : { kind: 'external' },
      mediaKind: 'image',
      mimeType: source.mimeType ?? undefined,
      width: source.width ?? undefined,
      height: source.height ?? undefined,
      durationSeconds: source.durationSeconds ?? undefined,
      now: input.now,
    });
  selectAssetFileInSession(input.session, {
    target: { kind: 'shot', id: input.destinationShotId },
    assetFileId,
    now: input.now,
  });
}
