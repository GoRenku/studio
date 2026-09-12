import type { ShotPlanClipTake } from '../../client/shot-plan-clips.js';
import { registerClipTakeInSession } from '../shot-plan-clips/commands.js';
import { createAssetMembership } from '../assets/ownership.js';
import { selectAssetInSession } from '../assets/selection.js';
import type { AssetOwner, AssetSelectionTarget } from '../../client/assets.js';
import { insertAssetRecord } from '../database/access/assets.js';
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
  asset: {
    localeId?: string | null;
    type: string;
    mediaKind: 'image' | 'audio' | 'video';
    title: string;
    oneLineSummary?: string | null;
    referenceName?: string | null;
    tags?: string[];
    origin: string;
  };
  fileRole: string;
  selectionTarget?: AssetSelectionTarget;
  generationProvenance?: MediaGenerationProvenance;
  authoredFromShotPlanId?: string;
  previsRevisionId?: string;
  clipTake?: { clipId: string; title?: string; sourceTakeId?: string };
}

export interface PersistedGeneratedMediaAttachment {
  take?: ShotPlanClipTake;
  assetId: string;
  assetFileId: string;
  ownerRecord?: {
    kind: 'lookbookImage' | 'lookbookSheet';
    id: string;
  };
}

export interface PersistGeneratedMediaAssetInSessionInput {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  assetId: string;
  assetFileId: string;
  now: string;
  sourceProjectRelativePath: string;
  destination: ProjectAssetFileDestination;
  owner: AssetOwner;
  selectionTarget?: AssetSelectionTarget;
  asset: PersistGeneratedMediaAttachmentInput['asset'];
  fileRole: string;
  generationProvenance?: MediaGenerationProvenance;
  authoredFromShotPlanId?: string;
  previsRevisionId?: string;
}

export function persistOwnedGeneratedMediaAssetInSession(
  input: PersistGeneratedMediaAssetInSessionInput
): ReturnType<typeof persistProjectAssetFileSync> {
  insertAssetRecord(input.session, {
    previsRevisionId: input.previsRevisionId,
    id: input.assetId,
    ...(input.asset.localeId !== undefined
      ? { localeId: input.asset.localeId }
      : {}),
    type: input.asset.type,
    mediaKind: input.asset.mediaKind,
    title: input.asset.title,
    ...(input.asset.oneLineSummary !== undefined
      ? { oneLineSummary: input.asset.oneLineSummary ?? undefined }
      : {}),
    ...(input.asset.referenceName !== undefined
      ? { referenceName: input.asset.referenceName }
      : {}),
    ...(input.asset.tags !== undefined ? { tags: input.asset.tags } : {}),
    origin: input.asset.origin,
    availability: 'ready',
    ...(input.generationProvenance
      ? { generationProvenance: input.generationProvenance }
      : {}),
    ...(input.authoredFromShotPlanId
      ? { authoredFromShotPlanId: input.authoredFromShotPlanId }
      : {}),
    createdAt: input.now,
    updatedAt: input.now,
  });
  createAssetMembership(input.session, {
    assetId: input.assetId,
    owner: input.owner,
    now: input.now,
  });
  const assetFile = persistProjectAssetFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    writeSet: input.writeSet,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: input.destination,
    namingMode: input.asset.origin === 'generated'
      ? { kind: 'generated' }
      : { kind: 'external' },
    fileRole: input.fileRole,
    mediaKind: input.asset.mediaKind,
    now: input.now,
  });
  if (input.selectionTarget) {
    selectAssetInSession(input.session, {
      target: input.selectionTarget,
      assetId: input.assetId,
      now: input.now,
    });
  }
  return assetFile;
}

export function persistGeneratedMediaAttachment(
  input: PersistGeneratedMediaAttachmentInput
): PersistedGeneratedMediaAttachment {
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const lookbookDetailKind = input.destination.owner.kind === 'lookbook'
    ? input.asset.type === 'lookbook_image'
      ? 'image'
      : input.asset.type === 'lookbook_sheet'
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
      persistOwnedGeneratedMediaAssetInSession({
        previsRevisionId: input.previsRevisionId,
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        now: input.now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: input.destination.file,
        owner: input.destination.owner,
        ...(input.selectionTarget ? { selectionTarget: input.selectionTarget } : {}),
        asset: input.asset,
        fileRole: input.fileRole,
        ...(input.generationProvenance
          ? { generationProvenance: input.generationProvenance }
          : {}),
        ...(input.authoredFromShotPlanId
          ? { authoredFromShotPlanId: input.authoredFromShotPlanId }
          : {}),
      });
      if (input.clipTake) {
        take = registerClipTakeInSession(session, { ...input.clipTake, assetId, assetFileId });
      }
      if (input.destination.owner.kind === 'lookbook' && ownerRecord?.kind === 'lookbookImage') {
        insertLookbookImageRecord(session, {
          id: ownerRecord.id,
          assetId,
          sortOrder: nextLookbookImageSortOrder(session, input.destination.owner.id),
          now: input.now,
        });
      }
      if (input.destination.owner.kind === 'lookbook' && ownerRecord?.kind === 'lookbookSheet') {
        insertLookbookSheetRecord(session, {
          id: ownerRecord.id,
          assetId,
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
    assetId,
    assetFileId,
    ...(ownerRecord ? { ownerRecord } : {}),
  };
}
