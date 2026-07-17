import type { Asset, GenerationPurpose, GenerationTarget } from '../../client/index.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { generationRunIdFromReceipt } from '../asset-file-generation/import-provenance.js';
import { readGenerationRunRecord } from '../database/access/media-generation.js';
import { requireLookbookRecordById } from '../database/access/lookbook.js';
import {
  castCharacterSheetAttachmentDestination,
  castProfileAttachmentDestination,
  locationHeroAttachmentDestination,
  locationSheetAttachmentDestination,
  lookbookImageAttachmentDestination,
  lookbookSheetAttachmentDestination,
  type GeneratedMediaAttachmentDestination,
} from './attachment-destinations.js';
import { persistGeneratedMediaAttachment } from './attachment-persistence.js';

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
  validateLookbookKind(input);
  const persisted = persistGeneratedMediaAttachment({
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
    now: new Date().toISOString(),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: attachment.destination,
    asset: {
      type: attachment.assetType,
      mediaKind: 'image',
      title: input.title?.trim() || attachment.label,
      origin: generationRunId ? 'generated' : 'external',
    },
    fileRole: 'primary',
    relationshipRole: attachment.relationshipRole,
    ...(generationRunId ? { provenanceReceipt: input.receipt } : {}),
  });
  const project = readProjectRecord(input.session);
  const attached = readAssetRelationship(input.session, {
    target: attachment.destination.target,
    assetId: persisted.assetId,
  });
  if (!project || !attached) {
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
    ...(persisted.ownerRecord ? { ownerRecord: persisted.ownerRecord } : {}),
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

function attachmentDestination(input: AttachGenerationMediaInput): {
  destination: GeneratedMediaAttachmentDestination;
  relationshipRole: string;
  label: string;
  assetType: string;
  resourceKeys: string[];
} {
  switch (input.purpose) {
    case 'lookbook.image': {
      assertTarget(input, 'lookbook');
      return attachmentDetails(
        lookbookImageAttachmentDestination(input.target.id, input.title),
        'lookbook-image',
        'Lookbook Image'
      );
    }
    case 'lookbook.video-sheet': {
      assertTarget(input, 'lookbook');
      return attachmentDetails(
        lookbookSheetAttachmentDestination(input.target.id, input.title),
        'video-lookbook-sheet',
        'Video Lookbook Sheet'
      );
    }
    case 'lookbook.storyboard-sheet': {
      assertTarget(input, 'lookbook');
      return attachmentDetails(
        lookbookSheetAttachmentDestination(input.target.id, input.title),
        'storyboard-lookbook-sheet',
        'Storyboard Lookbook Sheet'
      );
    }
    case 'cast.character-sheet': {
      assertTarget(input, 'castMember');
      return attachmentDetails(
        castCharacterSheetAttachmentDestination(input.target.id, input.title),
        'character-sheet',
        'Character Sheet',
        'character_sheet'
      );
    }
    case 'cast.profile': {
      assertTarget(input, 'castMember');
      return attachmentDetails(
        castProfileAttachmentDestination(input.target.id, input.title),
        'profile',
        'Profile'
      );
    }
    case 'location.sheet': {
      assertTarget(input, 'location');
      return attachmentDetails(
        locationSheetAttachmentDestination(input.target.id, input.title),
        'location-sheet',
        'Location Sheet'
      );
    }
    case 'location.hero': {
      assertTarget(input, 'location');
      return attachmentDetails(
        locationHeroAttachmentDestination(input.target.id, input.title),
        'hero',
        'Location Hero',
        'location-hero'
      );
    }
    default:
      throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_UNSUPPORTED', `Focused media attachment is not available for ${input.purpose}.`);
  }
}

function attachmentDetails(
  destination: GeneratedMediaAttachmentDestination,
  relationshipRole: string,
  label: string,
  assetType = relationshipRole
) {
  return {
    destination,
    relationshipRole,
    label,
    assetType,
    resourceKeys: destination.resourceKeys,
  };
}

function validateLookbookKind(
  input: AttachGenerationMediaInput & { session: DatabaseSession }
): void {
  if (input.target.kind !== 'lookbook') {
    return;
  }
  const lookbook = requireLookbookRecordById(input.session, input.target.id);
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
}

function assertTarget(input: AttachGenerationMediaInput, kind: GenerationTarget['kind']): void {
  if (input.target.kind !== kind) {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', `${input.purpose} cannot attach media to ${input.target.kind}.`);
  }
}
