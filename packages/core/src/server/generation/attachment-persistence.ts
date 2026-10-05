import type { ShotPlanClipTake } from '../../client/shot-plan-clips.js';
import { registerClipTakeInSession } from '../shot-plan-clips/commands.js';
import { selectAssetFileInSession, selectFirstContinuityImageInSession } from '../asset-files/selection.js';
import type { AssetFileOwner, AssetFileSelectionTarget } from '../../client/asset-files.js';
import {
  insertLookbookImageRecord,
  nextLookbookImageSortOrder,
} from '../database/access/lookbook-images.js';
import {
  insertLookbookSheetRecord,
  nextLookbookSheetSortOrder,
} from '../database/access/lookbook-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import {
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import type { GeneratedMediaAttachmentDestination } from './attachment-destinations.js';
import type {
  ProjectAssetFileDestination,
  ProjectAssetFileWriteSet,
} from '../project-asset-files/index.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';

export interface PersistGeneratedMediaAttachmentInput {
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
  now: string;
  sourceProjectRelativePath: string;
  destination: GeneratedMediaAttachmentDestination;
  assetFileMetadata: {
    localeId?: string | null;
    type: string;
    mediaKind: 'image' | 'audio' | 'video';
    title: string | null;
    oneLineSummary?: string | null;
    referenceName?: string | null;
    tags?: string[];
    origin: string;
  };
  selectionTarget?: AssetFileSelectionTarget;
  generationProvenance?: MediaGenerationProvenance;
  authoredFromShotPlanId?: string;
  previsRevisionId?: string;
  clipTake?: { clipId: string; title?: string; sourceTakeId?: string };
}

export interface PersistedGeneratedMediaAttachment {
  take?: ShotPlanClipTake;
  assetFileId: string;
  ownerRecord?: {
    kind: 'lookbookImage' | 'lookbookSheet';
    id: string;
  };
}

export interface PersistGeneratedMediaAssetFileInSessionInput {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  assetFileId: string;
  now: string;
  sourceProjectRelativePath: string;
  destination: ProjectAssetFileDestination;
  owner: AssetFileOwner;
  selectionTarget?: AssetFileSelectionTarget;
  assetFileMetadata: PersistGeneratedMediaAttachmentInput['assetFileMetadata'];
  generationProvenance?: MediaGenerationProvenance;
  authoredFromShotPlanId?: string;
  previsRevisionId?: string;
}

export function persistOwnedGeneratedMediaAssetFileInSession(
  input: PersistGeneratedMediaAssetFileInSessionInput
): ReturnType<typeof persistProjectAssetFileSync> {
  const assetFile = persistProjectAssetFileSync({
    owner: input.owner,
    assetFileMetadata: {
      previsRevisionId: input.previsRevisionId,
      ...(input.assetFileMetadata.localeId !== undefined
        ? { localeId: input.assetFileMetadata.localeId }
        : {}),
      type: input.assetFileMetadata.type,
      title: input.assetFileMetadata.title,
      ...(input.assetFileMetadata.oneLineSummary !== undefined
        ? { oneLineSummary: input.assetFileMetadata.oneLineSummary ?? undefined }
        : {}),
      ...(input.assetFileMetadata.referenceName !== undefined
        ? { referenceName: input.assetFileMetadata.referenceName }
        : {}),
      ...(input.assetFileMetadata.tags !== undefined ? { tags: input.assetFileMetadata.tags } : {}),
      origin: input.assetFileMetadata.origin,
      ...(input.generationProvenance
        ? { generationProvenance: input.generationProvenance }
        : {}),
      ...(input.authoredFromShotPlanId
        ? { authoredFromShotPlanId: input.authoredFromShotPlanId }
        : {}),
    },
    session: input.session,
    projectFolder: input.projectFolder,
    writeSet: input.writeSet,
    assetFileId: input.assetFileId,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: input.destination,
    namingMode: input.assetFileMetadata.origin === 'generated'
        ? { kind: 'generated' }
      : { kind: 'external' },
    mediaKind: input.assetFileMetadata.mediaKind,
    now: input.now,
  });
  if (input.selectionTarget) {
    selectAssetFileInSession(input.session, {
      target: input.selectionTarget,
      assetFileId: input.assetFileId,
      now: input.now,
    });
  } else {
    selectFirstContinuityImageInSession(input.session, {
      owner: input.owner,
      assetFileType: input.assetFileMetadata.type,
      assetFileId: input.assetFileId,
      now: input.now,
    });
  }
  return assetFile;
}

export function persistGeneratedMediaAttachment(
  input: PersistGeneratedMediaAttachmentInput
): PersistedGeneratedMediaAttachment {
  const assetFileId = input.idGenerator.next('asset_file');
  const lookbookDetailKind = input.destination.owner.kind === 'lookbook'
    ? input.assetFileMetadata.type === 'lookbook_image'
      ? 'image'
      : input.assetFileMetadata.type === 'lookbook_sheet'
        ? 'sheet'
        : null
    : null;
  const ownerRecord = lookbookDetailKind
    ? {
        kind: lookbookDetailKind === 'image' ? 'lookbookImage' as const : 'lookbookSheet' as const,
        id: input.idGenerator.next(
          lookbookDetailKind === 'image' ? 'lookbook_image' : 'lookbook_sheet'
        ),
      }
    : undefined;
  const writeSet = createProjectAssetFileWriteSet({
    projectFolder: input.projectFolder,
  });
  let take: ShotPlanClipTake | undefined;
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      persistOwnedGeneratedMediaAssetFileInSession({
        previsRevisionId: input.previsRevisionId,
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetFileId,
        now: input.now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: input.destination.file,
        owner: input.destination.owner,
        ...(input.selectionTarget ? { selectionTarget: input.selectionTarget } : {}),
        assetFileMetadata: input.assetFileMetadata,
        ...(input.generationProvenance
          ? { generationProvenance: input.generationProvenance }
          : {}),
        ...(input.authoredFromShotPlanId
          ? { authoredFromShotPlanId: input.authoredFromShotPlanId }
          : {}),
      });
      if (input.clipTake) {
        take = registerClipTakeInSession(session, { ...input.clipTake, assetFileId });
      }
      if (input.destination.owner.kind === 'lookbook' && ownerRecord?.kind === 'lookbookImage') {
        insertLookbookImageRecord(session, {
          id: ownerRecord.id,
          assetFileId,
          sortOrder: nextLookbookImageSortOrder(session, input.destination.owner.id),
          now: input.now,
        });
      }
      if (input.destination.owner.kind === 'lookbook' && ownerRecord?.kind === 'lookbookSheet') {
        insertLookbookSheetRecord(session, {
          id: ownerRecord.id,
          assetFileId,
          sortOrder: nextLookbookSheetSortOrder(session, input.destination.owner.id),
          now: input.now,
        });
      }
    });
    writeSet.markCommitted();
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }

  return {
    ...(take ? { take } : {}),
    assetFileId,
    ...(ownerRecord ? { ownerRecord } : {}),
  };
}
