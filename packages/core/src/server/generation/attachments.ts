import type { Asset, AssetTarget, GenerationPurpose, GenerationTarget } from '../../client/index.js';
import { insertAssetRelationshipRecord, nextAssetRelationshipSortOrder, readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { createProjectAssetFileWriteSet, persistProjectAssetFileSync, rollbackProjectAssetFileWriteSetSync, type ProjectAssetFileDestination } from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { generationRunIdFromReceipt, recordImportedAssetFileGenerationProvenanceInSession } from '../asset-file-generation/import-provenance.js';
import { readGenerationRunRecord } from '../database/access/media-generation.js';
import { and, eq, isNull } from 'drizzle-orm';
import { sceneShotVideoTakes } from '../schema/index.js';
import { insertLookbookImageRecord, nextLookbookImageSortOrder } from '../database/access/lookbook-images.js';
import { insertLookbookSheetRecord, nextLookbookSheetSortOrder } from '../database/access/lookbook-sheets.js';
import { requireLookbookRecordById } from '../database/access/lookbook.js';
import { readAssetFileRecord } from '../database/access/asset-files.js';
import {
  insertShotVideoTakeImage,
  insertShotVideoTakeVideo,
  type ShotVideoTakeImageRole,
} from '../database/access/shot-video-take-media.js';

export interface AttachGenerationMediaInput {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
}

export interface GenerationMediaAttachmentReport {
  valid: true;
  purpose: GenerationPurpose;
  target: GenerationTarget;
  asset: Asset | { assetId: string; assetFileId: string; projectRelativePath: string };
  provenance: { generationRunId: string } | null;
  resourceKeys: string[];
  project: { name: string; id: string; projectFolder: string };
  ownerRecord?: { kind: 'lookbookImage' | 'lookbookSheet'; id: string };
}

export function attachGenerationMedia(input: AttachGenerationMediaInput & {
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
}): GenerationMediaAttachmentReport {
  const attachment = attachmentDestination(input);
  const generationRunId = validateGenerationProvenance(input);
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const relationshipId = attachment.owner
    ? input.idGenerator.next(relationshipPrefix(attachment.owner))
    : null;
  const ownerRecordId = attachment.lookbookRecord === 'image'
    ? input.idGenerator.next('lookbook_image')
    : attachment.lookbookRecord === 'sheet'
      ? input.idGenerator.next('lookbook_sheet')
      : null;
  const now = new Date().toISOString();
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      insertAssetRecord(session, {
        id: assetId,
        type: attachment.assetType,
        mediaKind: attachment.mediaKind,
        title: input.title?.trim() || attachment.label,
        origin: generationRunId ? 'generated' : 'external',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      const file = persistProjectAssetFileSync({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: attachment.destination,
        fileRole: 'primary',
        mediaKind: attachment.mediaKind,
        now,
      });
      if (attachment.owner && relationshipId) {
        insertAssetRelationshipRecord(session, attachment.owner, {
          relationshipId,
          assetId,
          localeId: null,
          role: attachment.role,
          sortOrder: nextAssetRelationshipSortOrder(session, { target: attachment.owner, role: attachment.role, localeId: null }),
          now,
        });
      }
      if (attachment.lookbookRecord) {
        assertTarget(input, 'lookbook');
        const lookbook = requireLookbookRecordById(session, input.target.id);
        const requiredKind = input.purpose === 'lookbook.video-sheet'
          ? 'production'
          : input.purpose === 'lookbook.storyboard-sheet'
            ? 'storyboard'
            : null;
        if (requiredKind && lookbook.kind !== requiredKind) {
          throw new ProjectDataError(
            'CORE_LOOKBOOK_TARGET_KIND_INVALID',
            `${input.purpose} requires the current ${requiredKind} Lookbook.`
          );
        }
        if (attachment.lookbookRecord === 'image') {
          insertLookbookImageRecord(session, {
            id: ownerRecordId!,
            lookbookId: input.target.id,
            assetId,
            sortOrder: nextLookbookImageSortOrder(session, input.target.id),
            now,
          });
        } else {
          insertLookbookSheetRecord(session, {
            id: ownerRecordId!,
            lookbookId: input.target.id,
            assetId,
            sortOrder: nextLookbookSheetSortOrder(session, input.target.id),
            now,
          });
        }
      }
      if (attachment.takeId && attachment.takeImageRole) {
        insertShotVideoTakeImage({ session, takeId: attachment.takeId, role: attachment.takeImageRole, assetId, assetFileId, now });
      } else if (attachment.takeId) {
        insertShotVideoTakeVideo({ session, takeId: attachment.takeId, assetId, assetFileId, now });
      }
      if (generationRunId) {
        recordImportedAssetFileGenerationProvenanceInSession({ session, assetFileId, receipt: input.receipt });
      }
      void file;
      writeSet.markCommitted();
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  const project = readProjectRecord(input.session);
  let attached: GenerationMediaAttachmentReport['asset'];
  if (attachment.owner) {
    const relationship = readAssetRelationship(input.session, {
      target: attachment.owner,
      assetId,
    });
    if (!relationship) {
      throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_FAILED', 'Generation media attachment was not persisted.');
    }
    attached = relationship;
  } else {
    const file = readAssetFileRecord(input.session, { assetId, assetFileId });
    if (!file) {
      throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_FAILED', 'Generation media attachment was not persisted.');
    }
    attached = { assetId, assetFileId, projectRelativePath: file.projectRelativePath };
  }
  if (!project) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_FAILED', 'Generation media attachment was not persisted.');
  }
  return {
    valid: true,
    purpose: input.purpose,
    target: input.target,
    asset: attached,
    provenance: generationRunId ? { generationRunId } : null,
    resourceKeys: attachment.resourceKeys,
    project: { name: project.name, id: project.id, projectFolder: input.projectFolder },
    ...(ownerRecordId && attachment.lookbookRecord
      ? {
          ownerRecord: {
            kind: attachment.lookbookRecord === 'image' ? 'lookbookImage' as const : 'lookbookSheet' as const,
            id: ownerRecordId,
          },
        }
      : {}),
  };
}

function validateGenerationProvenance(input: AttachGenerationMediaInput & { session: DatabaseSession }): string | null {
  if (input.receipt === undefined) {
    return null;
  }
  const generationRunId = generationRunIdFromReceipt(input.receipt);
  if (!generationRunId) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'Generation receipt does not identify a Renku generation run.');
  }
  const run = readGenerationRunRecord(input.session, generationRunId);
  if (!run || run.specSnapshot.purpose !== input.purpose || run.specSnapshot.target.kind !== input.target.kind || run.specSnapshot.target.id !== input.target.id) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'Generation run purpose and target must match the focused attachment.');
  }
  if (!run.outputs.some((output) => output.projectRelativePath === input.sourceProjectRelativePath)) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'The attached source must be an exact output of the supplied generation run.');
  }
  return generationRunId;
}

function attachmentDestination(input: AttachGenerationMediaInput & { session: DatabaseSession }): {
  destination: ProjectAssetFileDestination;
  owner: AssetTarget | null;
  role: string;
  label: string;
  assetType: string;
  mediaKind: 'image' | 'audio' | 'video';
  resourceKeys: string[];
  takeId?: string;
  takeImageRole?: ShotVideoTakeImageRole;
  lookbookRecord?: 'image' | 'sheet';
} {
  switch (input.purpose) {
    case 'lookbook.image':
      return { ...projectAttachment(input, { kind: 'visualLanguage.lookbookImage', titleHint: input.title }, 'lookbook-image', 'Lookbook Image'), lookbookRecord: 'image' as const };
    case 'lookbook.video-sheet':
      return { ...projectAttachment(input, { kind: 'visualLanguage.lookbookSheet', titleHint: input.title }, 'video-lookbook-sheet', 'Video Lookbook Sheet'), lookbookRecord: 'sheet' as const };
    case 'lookbook.storyboard-sheet':
      return { ...projectAttachment(input, { kind: 'visualLanguage.lookbookSheet', titleHint: input.title }, 'storyboard-lookbook-sheet', 'Storyboard Lookbook Sheet'), lookbookRecord: 'sheet' as const };
    case 'cast.character-sheet': {
      assertTarget(input, 'castMember');
      const role = 'character-sheet';
      return { destination: { kind: 'cast.characterSheet', castMemberId: input.target.id, titleHint: input.title }, owner: { kind: 'castMember', castMemberId: input.target.id }, role, label: 'Character Sheet', assetType: 'character_sheet', mediaKind: 'image', resourceKeys: [`cast:${input.target.id}`] };
    }
    case 'cast.profile':
      assertTarget(input, 'castMember');
      return { destination: { kind: 'cast.profile', castMemberId: input.target.id, titleHint: input.title }, owner: { kind: 'castMember', castMemberId: input.target.id }, role: 'profile', label: 'Profile', assetType: 'profile', mediaKind: 'image', resourceKeys: [`cast:${input.target.id}`] };
    case 'location.sheet':
      assertTarget(input, 'location');
      return { destination: { kind: 'location.environmentSheet', locationId: input.target.id, titleHint: input.title }, owner: { kind: 'location', locationId: input.target.id }, role: 'location-sheet', label: 'Location Sheet', assetType: 'location-sheet', mediaKind: 'image', resourceKeys: [`location:${input.target.id}`] };
    case 'location.hero':
      assertTarget(input, 'location');
      return { destination: { kind: 'location.hero', locationId: input.target.id, heroName: input.title }, owner: { kind: 'location', locationId: input.target.id }, role: 'hero', label: 'Location Hero', assetType: 'location-hero', mediaKind: 'image', resourceKeys: [`location:${input.target.id}`] };
    case 'shot.video-take': {
      assertTarget(input, 'sceneShotVideoTake');
      const take = input.session.db.select().from(sceneShotVideoTakes).where(and(eq(sceneShotVideoTakes.id, input.target.id), isNull(sceneShotVideoTakes.discardedAt))).get();
      if (!take) {
        throw new ProjectDataError('CORE_GENERATION_TARGET_NOT_FOUND', `Scene Shot Video Take was not found: ${input.target.id}.`);
      }
      return { destination: { kind: 'shotVideoTake.media', takeId: take.id, role: 'video' }, owner: null, role: 'shot-video-take', label: 'Shot Video Take', assetType: 'shot-video-take', mediaKind: 'video', resourceKeys: [`scene:${take.sceneId}`, `scene-shot-video-take:${take.id}`], takeId: take.id };
    }
    case 'shot.first-frame':
      return takeImageAttachment(input, 'first-frame', 'First Frame');
    case 'shot.last-frame':
      return takeImageAttachment(input, 'last-frame', 'Last Frame');
    case 'shot.video-prompt':
      return takeImageAttachment(input, 'video-prompt', 'Video Prompt Image');
    default:
      throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_UNSUPPORTED', `Focused media attachment is not available for ${input.purpose}.`);
  }
}

function takeImageAttachment(
  input: AttachGenerationMediaInput & { session: DatabaseSession },
  role: ShotVideoTakeImageRole,
  label: string
) {
  assertTarget(input, 'sceneShotVideoTake');
  const take = input.session.db.select().from(sceneShotVideoTakes).where(and(
    eq(sceneShotVideoTakes.id, input.target.id),
    isNull(sceneShotVideoTakes.discardedAt)
  )).get();
  if (!take) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_NOT_FOUND',
      `Scene Shot Video Take was not found: ${input.target.id}.`
    );
  }
  return {
    destination: { kind: 'shotVideoTake.media' as const, takeId: take.id, role },
    owner: null,
    role,
    label,
    assetType: role,
    mediaKind: 'image' as const,
    resourceKeys: [`scene:${take.sceneId}`, `scene-shot-video-take:${take.id}`],
    takeId: take.id,
    takeImageRole: role,
  };
}

function projectAttachment(input: AttachGenerationMediaInput, destination: ProjectAssetFileDestination, role: string, label: string) {
  assertTarget(input, 'lookbook');
  return { destination, owner: { kind: 'project' } as const, role, label, assetType: role, mediaKind: 'image' as const, resourceKeys: ['visual-language'] };
}

function assertTarget(input: AttachGenerationMediaInput, kind: GenerationTarget['kind']): void {
  if (input.target.kind !== kind) {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', `${input.purpose} cannot attach media to ${input.target.kind}.`);
  }
}

function relationshipPrefix(target: AssetTarget): 'project_asset' | 'cast_asset' | 'location_asset' | 'sequence_asset' | 'scene_asset' {
  return target.kind === 'project' ? 'project_asset' : target.kind === 'castMember' ? 'cast_asset' : target.kind === 'location' ? 'location_asset' : target.kind === 'sequence' ? 'sequence_asset' : 'scene_asset';
}
