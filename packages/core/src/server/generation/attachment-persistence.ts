import { recordImportedAssetFileGenerationProvenanceInSession } from '../asset-file-generation/import-provenance.js';
import { recordSelectedGenerationOutputProvenanceInSession } from '../asset-file-generation/commands.js';
import {
  assetRelationshipIdPrefix,
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
} from '../database/access/asset-relationships/index.js';
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
  relationshipRole: string;
  provenanceReceipt?: unknown;
  sourceSpecId?: string;
}

export interface PersistedGeneratedMediaAttachment {
  assetId: string;
  assetFileId: string;
  relationshipId?: string;
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
  asset: PersistGeneratedMediaAttachmentInput['asset'];
  fileRole: string;
  provenanceReceipt?: unknown;
  selectedGenerationOutput?: {
    generationRunId: string;
    outputArtifactId: string;
  };
  sourceSpecId?: string;
}

export function persistGeneratedMediaAssetInSession(
  input: PersistGeneratedMediaAssetInSessionInput
): void {
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
  persistProjectAssetFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    writeSet: input.writeSet,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: input.destination,
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
}

export function persistGeneratedMediaAttachment(
  input: PersistGeneratedMediaAttachmentInput
): PersistedGeneratedMediaAttachment {
  if (input.provenanceReceipt !== undefined && input.sourceSpecId) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_PROVENANCE_CONFLICT',
      'Generated media attachment accepts one generation source.',
    );
  }
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const membership = input.destination.lookbookMembership;
  const relationshipId = membership
    ? undefined
    : input.idGenerator.next(assetRelationshipIdPrefix(input.destination.target));
  const ownerRecord = membership
    ? {
        kind: membership.kind === 'image' ? 'lookbookImage' as const : 'lookbookSheet' as const,
        id: input.idGenerator.next(
          membership.kind === 'image' ? 'lookbook_image' : 'lookbook_sheet'
        ),
      }
    : undefined;
  const writeSet = createProjectAssetFileWriteSet({
    projectFolder: input.projectFolder,
  });

  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      persistGeneratedMediaAssetInSession({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        now: input.now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: input.destination.file,
        asset: input.asset,
        fileRole: input.fileRole,
        ...(input.provenanceReceipt !== undefined
          ? { provenanceReceipt: input.provenanceReceipt }
          : {}),
        ...(input.sourceSpecId ? { sourceSpecId: input.sourceSpecId } : {}),
      });
      if (relationshipId) {
        insertAssetRelationshipRecord(session, input.destination.target, {
          relationshipId,
          assetId,
          localeId: null,
          role: input.relationshipRole,
          sortOrder: nextAssetRelationshipSortOrder(session, {
            target: input.destination.target,
            role: input.relationshipRole,
            localeId: null,
          }),
          now: input.now,
        });
      }

      if (membership && ownerRecord?.kind === 'lookbookImage') {
        insertLookbookImageRecord(session, {
          id: ownerRecord.id,
          lookbookId: membership.lookbookId,
          assetId,
          sortOrder: nextLookbookImageSortOrder(session, membership.lookbookId),
          now: input.now,
        });
      }
      if (membership && ownerRecord?.kind === 'lookbookSheet') {
        insertLookbookSheetRecord(session, {
          id: ownerRecord.id,
          lookbookId: membership.lookbookId,
          assetId,
          sortOrder: nextLookbookSheetSortOrder(session, membership.lookbookId),
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
    ...(relationshipId ? { relationshipId } : {}),
    ...(ownerRecord ? { ownerRecord } : {}),
  };
}
