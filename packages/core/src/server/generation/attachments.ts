import type {
  Asset,
  AssetMetadataInput,
} from '../../client/assets.js';
import type { MediaPurpose, MediaTarget } from '../../client/media-attachments.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import type { DialogueTurnRange } from '../../client/shot-plan-dialogue-audio.js';
import { normalizeAssetMetadata } from '../assets/metadata.js';
import { validateMediaGenerationProvenance } from '../assets/generation-provenance.js';
import { readOwnedAsset } from '../assets/projection.js';
import { assetSelectionTargetForOwnerType } from '../assets/selection.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { requireLookbookRecordById } from '../database/access/lookbook.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  generatedMediaAttachmentResourceKeys,
  generationAttachmentAssetType,
  resolveGeneratedMediaAttachment,
} from './attachment-destinations.js';
import { persistGeneratedMediaAttachment } from './attachment-persistence.js';
import { attachShotPlanDialogueAudio } from '../shot-plan-dialogue-audio/attachment.js';
import { attachImageEditMedia } from '../image-edit-attachments/index.js';
import { attachVideoEditMedia } from '../video-edit-attachments/index.js';
import { validatePrevisGenerationSource } from '../shot-plan-previs/generation-source.js';

export interface AttachGenerationMediaInput {
  purpose: MediaPurpose;
  target: MediaTarget;
  sourceProjectRelativePath: string;
  title?: string;
  assetMetadata?: AssetMetadataInput;
  generationProvenance?: MediaGenerationProvenance;
  select?: boolean;
  turnRange?: DialogueTurnRange;
  previsRevisionId?: string;
}

export interface GenerationMediaAttachmentReport {
  valid: true;
  purpose: MediaPurpose;
  target: MediaTarget;
  asset: Asset;
  generationProvenance: MediaGenerationProvenance | null;
  resourceKeys: string[];
  project: { projectName: string; id: string; projectFolder: string };
  ownerRecord?: { kind: 'lookbookImage' | 'lookbookSheet'; id: string };
}

export function attachGenerationMedia(input: AttachGenerationMediaInput & {
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
}): GenerationMediaAttachmentReport {
  const previsRevisionId = validatePrevisGenerationSource(input.session, input);
  const generationProvenance = input.generationProvenance === undefined
    ? null
    : validateMediaGenerationProvenance(input.generationProvenance);
  if (input.purpose === 'image.edit') {
    if (input.target.kind !== 'asset' || !generationProvenance) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED',
        'image.edit attachment requires an Asset target and exact provenance.',
      );
    }
    return attachImageEditMedia({
      ...input,
      purpose: 'image.edit',
      target: input.target,
      generationProvenance,
    });
  }
  if (input.purpose === 'video.edit') {
    if (input.target.kind !== 'asset' || !generationProvenance) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED',
        'video.edit attachment requires an Asset target and exact provenance.',
      );
    }
    return attachVideoEditMedia({
      ...input,
      purpose: 'video.edit',
      target: input.target,
      generationProvenance,
    });
  }
  if (input.purpose === 'shot-plan.dialogue-audio') {
    if (input.target.kind !== 'shotPlan' || !generationProvenance || !input.turnRange) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED',
        'Shot Plan Dialogue Audio attachment requires a Shot Plan target, turn range, and exact provenance.',
      );
    }
    const attached = attachShotPlanDialogueAudio({
      ...input,
      shotPlanId: input.target.id,
      turnRange: input.turnRange,
      generationProvenance,
    });
    const project = readProjectRecord(input.session);
    if (!project) {
      throw new ProjectDataError(
        'CORE_GENERATION_ATTACHMENT_FAILED',
        'Shot Plan Dialogue Audio project was not found.',
      );
    }
    return {
      valid: true,
      purpose: input.purpose,
      target: input.target,
      asset: attached.asset,
      generationProvenance,
      resourceKeys: attached.resourceKeys,
      project: {
        projectName: project.projectName,
        id: project.id,
        projectFolder: input.projectFolder,
      },
    };
  }
  const assetType = generationAttachmentAssetType(input.purpose);
  if (requiresGenerationProvenance(assetType) && !generationProvenance) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED',
      `${input.purpose} attachments require exact media generation provenance.`,
    );
  }
  const attachment = resolveGeneratedMediaAttachment({
    purpose: input.purpose,
    target: input.target,
    session: input.session,
    ...(input.title ? { title: input.title } : {}),
  });
  if (generationProvenance && generationProvenance.mediaKind !== attachment.mediaKind) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      `Provenance media kind ${generationProvenance.mediaKind} does not match ${attachment.mediaKind} attachment.`,
    );
  }
  validateLookbookKind(input);
  const selectionTarget = input.select
    ? assetSelectionTargetForOwnerType(
        attachment.destination.owner,
        attachment.assetType,
      )
    : null;
  const authoredFromShotPlanId = input.target.kind === 'shotPlan'
    ? input.target.id
    : null;
  const persisted = persistGeneratedMediaAttachment({
    previsRevisionId,
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
    now: new Date().toISOString(),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: attachment.destination,
    asset: {
      type: attachment.assetType,
      mediaKind: attachment.mediaKind,
      title: input.title?.trim() || attachment.label,
      ...normalizeAssetMetadata(input.assetMetadata ?? {}),
      origin: generationProvenance ? 'generated' : 'external',
    },
    fileRole: 'primary',
    ...(selectionTarget ? { selectionTarget } : {}),
    ...(generationProvenance ? { generationProvenance } : {}),
    ...(authoredFromShotPlanId ? { authoredFromShotPlanId } : {}),
  });
  const project = readProjectRecord(input.session);
  const asset = readOwnedAsset(input.session, {
    owner: attachment.destination.owner,
    assetId: persisted.assetId,
  });
  if (!project || !asset) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Media attachment was not persisted.',
    );
  }
  return {
    valid: true,
    purpose: input.purpose,
    target: input.target,
    asset,
    generationProvenance,
    resourceKeys: generatedMediaAttachmentResourceKeys({
      attachment,
      authoredFromShotPlanId,
      session: input.session,
      selectionTarget,
    }),
    project: {
      projectName: project.projectName,
      id: project.id,
      projectFolder: input.projectFolder,
    },
    ...(persisted.ownerRecord ? { ownerRecord: persisted.ownerRecord } : {}),
  };
}

function requiresGenerationProvenance(assetType: string): boolean {
  return assetType === 'shot_plan_video'
    || assetType === 'shot_plan_video_first_frame'
    || assetType === 'shot_plan_video_last_frame'
    || assetType === 'shot_plan_video_storyboard'
    || assetType === 'shot_plan_video_reference';
}

function validateLookbookKind(
  input: AttachGenerationMediaInput & { session: DatabaseSession },
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
      `${input.purpose} requires the current ${requiredKind} Lookbook.`,
    );
  }
}
