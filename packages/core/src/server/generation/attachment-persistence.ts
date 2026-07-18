import { recordImportedAssetFileGenerationProvenanceInSession } from '../asset-file-generation/import-provenance.js';
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
  relationshipId: string;
  ownerRecord?: {
    kind: 'lookbookImage' | 'lookbookSheet';
    id: string;
  };
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
  const relationshipId = input.idGenerator.next(
    assetRelationshipIdPrefix(input.destination.target)
  );
  const membership = input.destination.lookbookMembership;
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
      insertAssetRecord(session, {
        id: assetId,
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
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: input.destination.file,
        fileRole: input.fileRole,
        mediaKind: input.asset.mediaKind,
        now: input.now,
      });
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
      if (input.provenanceReceipt !== undefined) {
        recordImportedAssetFileGenerationProvenanceInSession({
          session,
          assetFileId,
          receipt: input.provenanceReceipt,
        });
      }
      if (input.sourceSpecId) {
        setAssetFileSourceGenerationSpec(session, {
          assetFileId,
          sourceGenerationSpecId: input.sourceSpecId,
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
    relationshipId,
    ...(ownerRecord ? { ownerRecord } : {}),
  };
}
