import { recordImportedAssetFileGenerationProvenanceInSession } from '../asset-file-generation/import-provenance.js';
import { recordSelectedGenerationOutputProvenanceInSession } from '../asset-file-generation/commands.js';
import { createAssetMembership } from '../assets/ownership.js';
import { assetSelectionTargetForOwnerType, selectAssetInSession } from '../assets/selection.js';
import type { AssetOwner, AssetSelectionTarget } from '../../client/assets.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { setAssetFileSourceGenerationSpec } from '../database/access/asset-files.js';
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
import { ProjectDataError } from '../project-data-error.js';
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

export interface PersistGeneratedMediaAttachmentInput {
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
  now: string;
  sourceProjectRelativePath: string;
  destination: GeneratedMediaAttachmentDestination;
  asset: {
    type: string;
    mediaKind: 'image' | 'audio' | 'video';
    title: string;
    oneLineSummary?: string;
    origin: string;
  };
  fileRole: string;
  select?: boolean;
  provenanceReceipt?: unknown;
  selectedGenerationOutput?: {
    generationRunId: string;
    outputArtifactId: string;
  };
  sourceSpecId?: string;
}

export interface PersistedGeneratedMediaAttachment {
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
  provenanceReceipt?: unknown;
  selectedGenerationOutput?: {
    generationRunId: string;
    outputArtifactId: string;
  };
  sourceSpecId?: string;
}

export function persistOwnedGeneratedMediaAssetInSession(
  input: PersistGeneratedMediaAssetInSessionInput
): ReturnType<typeof persistProjectAssetFileSync> {
  const provenanceSourceCount = [
    input.provenanceReceipt !== undefined,
    input.selectedGenerationOutput !== undefined,
    input.sourceSpecId !== undefined,
  ].filter(Boolean).length;
  if (provenanceSourceCount > 1) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_PROVENANCE_CONFLICT',
      'Generated media attachment accepts one generation source.'
    );
  }
  insertAssetRecord(input.session, {
    id: input.assetId,
    type: input.asset.type,
    mediaKind: input.asset.mediaKind,
    title: input.asset.title,
    ...(input.asset.oneLineSummary
      ? { oneLineSummary: input.asset.oneLineSummary }
      : {}),
    origin: input.asset.origin,
    availability: 'ready',
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
  if (input.provenanceReceipt !== undefined) {
    recordImportedAssetFileGenerationProvenanceInSession({
      session: input.session,
      assetFileId: input.assetFileId,
      receipt: input.provenanceReceipt,
    });
  }
  if (input.selectedGenerationOutput) {
    recordSelectedGenerationOutputProvenanceInSession(input.session, {
      assetFileId: input.assetFileId,
      mediaGenerationRunId:
        input.selectedGenerationOutput.generationRunId,
      outputArtifactId: input.selectedGenerationOutput.outputArtifactId,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      createdAt: input.now,
    });
  }
  if (input.sourceSpecId) {
    setAssetFileSourceGenerationSpec(input.session, {
      assetFileId: input.assetFileId,
      sourceGenerationSpecId: input.sourceSpecId,
    });
  }
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
  const provenanceSourceCount = [
    input.provenanceReceipt !== undefined,
    input.selectedGenerationOutput !== undefined,
    input.sourceSpecId !== undefined,
  ].filter(Boolean).length;
  if (provenanceSourceCount > 1) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_PROVENANCE_CONFLICT',
      'Generated media attachment accepts one generation source.',
    );
  }
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
  const selectionTarget = input.select
    ? assetSelectionTargetForOwnerType(input.destination.owner, input.asset.type)
    : null;

  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      persistOwnedGeneratedMediaAssetInSession({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        now: input.now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: input.destination.file,
        owner: input.destination.owner,
        ...(selectionTarget ? { selectionTarget } : {}),
        asset: input.asset,
        fileRole: input.fileRole,
        ...(input.provenanceReceipt !== undefined
          ? { provenanceReceipt: input.provenanceReceipt }
          : {}),
        ...(input.selectedGenerationOutput
          ? { selectedGenerationOutput: input.selectedGenerationOutput }
          : {}),
        ...(input.sourceSpecId ? { sourceSpecId: input.sourceSpecId } : {}),
      });
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
    assetId,
    assetFileId,
    ...(ownerRecord ? { ownerRecord } : {}),
  };
}
