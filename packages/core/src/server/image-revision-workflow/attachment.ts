import type {
  GenerationRun,
  ImageRevisionTarget,
} from '../../client/index.js';
import { insertAssetRelationshipRecord, nextAssetRelationshipSortOrder } from '../database/access/asset-relationships/index.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { insertLookbookImageRecord, nextLookbookImageSortOrder } from '../database/access/lookbook-images.js';
import { insertLookbookSheetRecord, nextLookbookSheetSortOrder } from '../database/access/lookbook-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { recordImportedAssetFileGenerationProvenanceInSession } from '../asset-file-generation/import-provenance.js';
import {
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  rollbackProjectAssetFileWriteSetSync,
  type ProjectAssetFileDestination,
} from '../project-asset-files/index.js';
import type { AssetTarget } from '../../client/assets.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ResolvedImageRevisionSource } from './source.js';

export function attachImageRevisionOutput(input: {
  session: DatabaseSession;
  projectFolder: string;
  target: ImageRevisionTarget;
  source: ResolvedImageRevisionSource;
  run: GenerationRun;
  sourceProjectRelativePath: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}): {
  imported: { assetId: string; assetFileId: string };
  resourceKeys: string[];
} {
  const destination = revisionDestination(input);
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const relationshipId = destination.owner
    ? input.idGenerator.next(relationshipPrefix(destination.owner))
    : null;
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      insertAssetRecord(session, {
        id: assetId,
        type: destination.assetType,
        mediaKind: 'image',
        title: input.source.asset.title,
        ...(input.source.asset.oneLineSummary
          ? { oneLineSummary: input.source.asset.oneLineSummary }
          : {}),
        origin: 'generated',
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
        destination: destination.file,
        fileRole: destination.role,
        mediaKind: 'image',
        now: input.now,
      });
      if (destination.owner && relationshipId) {
        insertAssetRelationshipRecord(session, destination.owner, {
          relationshipId,
          assetId,
          localeId: null,
          role: destination.role,
          sortOrder: nextAssetRelationshipSortOrder(session, {
            target: destination.owner,
            role: destination.role,
            localeId: null,
          }),
          now: input.now,
        });
      }
      if (input.target.kind === 'lookbookImage') {
        insertLookbookImageRecord(session, {
          id: input.idGenerator.next('lookbook_image'),
          lookbookId: input.target.lookbookId,
          assetId,
          sortOrder: nextLookbookImageSortOrder(session, input.target.lookbookId),
          now: input.now,
        });
      }
      if (input.target.kind === 'lookbookSheet') {
        insertLookbookSheetRecord(session, {
          id: input.idGenerator.next('lookbook_sheet'),
          lookbookId: input.target.lookbookId,
          assetId,
          sortOrder: nextLookbookSheetSortOrder(session, input.target.lookbookId),
          now: input.now,
        });
      }
      recordImportedAssetFileGenerationProvenanceInSession({
        session,
        assetFileId,
        receipt: { run: input.run },
      });
      writeSet.markCommitted();
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  return {
    imported: { assetId, assetFileId },
    resourceKeys: destination.resourceKeys,
  };
}

function revisionDestination(input: {
  target: ImageRevisionTarget;
  source: ResolvedImageRevisionSource;
}): {
  file: ProjectAssetFileDestination;
  owner: AssetTarget | null;
  role: string;
  assetType: string;
  resourceKeys: string[];
} {
  switch (input.target.kind) {
    case 'castCharacterSheet':
      return {
        file: { kind: 'cast.characterSheet', castMemberId: input.target.castMemberId, titleHint: input.source.asset.title },
        owner: { kind: 'castMember', castMemberId: input.target.castMemberId },
        role: requireOwnerRole(input.source, ['character-sheet']),
        assetType: input.source.asset.type,
        resourceKeys: [`cast:${input.target.castMemberId}`],
      };
    case 'locationEnvironmentSheet':
      return {
        file: { kind: 'location.environmentSheet', locationId: input.target.locationId, titleHint: input.source.asset.title },
        owner: { kind: 'location', locationId: input.target.locationId },
        role: requireOwnerRole(input.source, [
          'environment-sheet',
          'location-sheet',
        ]),
        assetType: input.source.asset.type,
        resourceKeys: [`location:${input.target.locationId}`],
      };
    case 'lookbookImage':
      return {
        file: { kind: 'visualLanguage.lookbookImage', titleHint: input.source.asset.title },
        owner: { kind: 'project' },
        role: requireOwnerRole(input.source, ['lookbook-image']),
        assetType: input.source.asset.type,
        resourceKeys: ['visual-language'],
      };
    case 'lookbookSheet':
      return {
        file: { kind: 'visualLanguage.lookbookSheet', titleHint: input.source.asset.title },
        owner: { kind: 'project' },
        role: requireOwnerRole(input.source, [
          'storyboard-lookbook-sheet',
          'video-lookbook-sheet',
        ]),
        assetType: input.source.asset.type,
        resourceKeys: ['visual-language'],
      };
  }
}

function requireOwnerRole(
  source: ResolvedImageRevisionSource,
  allowedRoles: string[]
): string {
  if (source.ownerRole && allowedRoles.includes(source.ownerRole)) {
    return source.ownerRole;
  }
  throw new ProjectDataError(
    'CORE_IMAGE_REVISION_OWNER_MISMATCH',
    'The Image Revision source no longer has an eligible owner role.'
  );
}

function relationshipPrefix(
  target: AssetTarget
): 'project_asset' | 'cast_asset' | 'location_asset' | 'sequence_asset' | 'scene_asset' {
  if (target.kind === 'project') {
    return 'project_asset';
  }
  if (target.kind === 'castMember') {
    return 'cast_asset';
  }
  if (target.kind === 'location') {
    return 'location_asset';
  }
  if (target.kind === 'sequence') {
    return 'sequence_asset';
  }
  return 'scene_asset';
}
