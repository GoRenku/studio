import type { Asset, GenerationPurpose, GenerationTarget } from '../../client/index.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readAssetFileRecord } from '../database/access/asset-files.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { generationRunIdFromReceipt } from '../asset-file-generation/import-provenance.js';
import { readGenerationRunRecord, readGenerationSpecRecord } from '../database/access/media-generation.js';
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
import { validateImageEditAttachment } from './image-edit-attachment.js';

export interface AttachGenerationMediaInput {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
  sourceSpecId?: string;
}

export interface GenerationMediaAttachmentReport {
  valid: true;
  purpose: GenerationPurpose;
  target: GenerationTarget;
  asset: Asset | { assetId: string; assetFileId: string; projectRelativePath: string };
  provenance:
    | { generationRunId: string }
    | { generationSpecId: string }
    | null;
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
  const provenance = validateGenerationProvenance({
    ...input,
    destinationRelationshipRole: attachment.relationshipRole,
  });
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
      origin: provenance ? 'generated' : 'external',
    },
    fileRole: 'primary',
    relationshipRole: attachment.relationshipRole,
    ...(provenance?.kind === 'renku-managed'
      ? { provenanceReceipt: input.receipt }
      : {}),
    ...(provenance?.kind === 'agent-external'
      ? { sourceSpecId: provenance.generationSpecId }
      : {}),
  });
  const project = readProjectRecord(input.session);
  const attached = attachment.destination.lookbookMembership
    ? {
        assetId: persisted.assetId,
        assetFileId: persisted.assetFileId,
        projectRelativePath: persistedProjectRelativePath(input.session, persisted),
      }
    : readAssetRelationship(input.session, {
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
    provenance: provenance?.kind === 'renku-managed'
      ? { generationRunId: provenance.generationRunId }
      : provenance?.kind === 'agent-external'
        ? { generationSpecId: provenance.generationSpecId }
        : null,
    resourceKeys: attachment.resourceKeys,
    project: { name: project.name, id: project.id, projectFolder: input.projectFolder },
    ...(persisted.ownerRecord ? { ownerRecord: persisted.ownerRecord } : {}),
  };
}

function validateGenerationProvenance(input: AttachGenerationMediaInput & {
  session: DatabaseSession;
  destinationRelationshipRole: string;
}):
  | { kind: 'renku-managed'; generationRunId: string }
  | { kind: 'agent-external'; generationSpecId: string }
  | null {
  if (input.receipt !== undefined && input.sourceSpecId) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_PROVENANCE_CONFLICT',
      'Generation media attachment accepts either a receipt or a source spec, not both.',
    );
  }
  if (input.sourceSpecId) {
    const record = readGenerationSpecRecord(input.session, input.sourceSpecId);
    if (!record || record.spec.executionKind !== 'agent-external') {
      throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_SOURCE_SPEC_INVALID',
        'The source spec must be an agent-external request for this attachment.',
      );
    }
    if (record.frozenAt === null) {
      throw new ProjectDataError(
        'CORE_GENERATION_ATTACHMENT_SOURCE_SPEC_MUTABLE',
        'The agent-external source spec must be frozen before generated media can be attached.',
        { suggestion: 'Freeze the final reviewed request immediately before external generation.' }
      );
    }
    validateAttachmentRequestMatch(input, record.spec);
    return {
      kind: 'agent-external',
      generationSpecId: record.id,
    };
  }
  if (input.receipt === undefined) {
    return null;
  }
  const generationRunId = generationRunIdFromReceipt(input.receipt);
  if (!generationRunId) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'Generation receipt does not identify a Renku generation run.');
  }
  const run = readGenerationRunRecord(input.session, generationRunId);
  if (!run) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'Generation run purpose and target must match the focused attachment.');
  }
  validateAttachmentRequestMatch(input, run.specSnapshot);
  if (!run.outputs.some((output) => output.projectRelativePath === input.sourceProjectRelativePath)) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'The attached source must be an exact output of the supplied generation run.');
  }
  return { kind: 'renku-managed', generationRunId };
}

function validateAttachmentRequestMatch(
  input: AttachGenerationMediaInput & {
    session: DatabaseSession;
    destinationRelationshipRole: string;
  },
  spec: import('../../client/generation.js').GenerationSpec,
): void {
  if (spec.purpose === input.purpose &&
      spec.target.kind === input.target.kind &&
      spec.target.id === input.target.id) {
    return;
  }
  validateImageEditAttachment({
    session: input.session,
    spec,
    destinationPurpose: input.purpose,
    destinationTarget: input.target,
    destinationRelationshipRole: input.destinationRelationshipRole,
  });
}

function persistedProjectRelativePath(
  session: DatabaseSession,
  persisted: { assetId: string; assetFileId: string },
): string {
  const file = readAssetFileRecord(session, persisted);
  if (!file) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Generation media AssetFile was not persisted.'
    );
  }
  return file.projectRelativePath;
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
