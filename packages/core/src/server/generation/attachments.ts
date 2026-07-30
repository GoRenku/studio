import type { Asset, GenerationPurpose, GenerationTarget } from '../../client/index.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { generationRunIdFromReceipt } from '../asset-file-generation/import-provenance.js';
import { readGenerationRunRecord, readGenerationSpecRecord } from '../database/access/media-generation.js';
import { requireLookbookRecordById } from '../database/access/lookbook.js';
import {
  generatedMediaAttachmentResourceKeys,
  resolveGeneratedMediaAttachment,
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
  select?: boolean;
}

export interface GenerationMediaAttachmentReport {
  valid: true;
  purpose: GenerationPurpose;
  target: GenerationTarget;
  asset: Asset;
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
  const attachment = resolveGeneratedMediaAttachment(input);
  const provenance = validateGenerationProvenance({
    ...input,
    destinationAssetType: attachment.assetType,
  });
  const resourceKeys = generatedMediaAttachmentResourceKeys({
    attachment,
    generationSpecId: provenance?.generationSpecId ?? null,
    session: input.session,
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
      mediaKind: attachment.mediaKind,
      title: input.title?.trim() || attachment.label,
      origin: provenance ? 'generated' : 'external',
    },
    fileRole: 'primary',
    select: input.select,
    ...(provenance?.kind === 'renku-managed'
      ? {
          selectedGenerationOutput: {
            generationRunId: provenance.generationRunId,
            outputArtifactId: provenance.outputArtifactId,
          },
        }
      : {}),
    ...(provenance?.kind === 'agent-external'
      ? { sourceSpecId: provenance.generationSpecId }
      : {}),
  });
  const project = readProjectRecord(input.session);
  const attached = readOwnedAsset(input.session, {
    owner: attachment.destination.owner,
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
    resourceKeys,
    project: { name: project.name, id: project.id, projectFolder: input.projectFolder },
    ...(persisted.ownerRecord ? { ownerRecord: persisted.ownerRecord } : {}),
  };
}

export type ValidatedGenerationProvenance =
  | {
      kind: 'renku-managed';
      generationRunId: string;
      generationSpecId: string;
      outputArtifactId: string;
    }
  | { kind: 'agent-external'; generationSpecId: string }
  | null;

export function validateGenerationProvenance(input: AttachGenerationMediaInput & {
  session: DatabaseSession;
  destinationAssetType: string;
}): ValidatedGenerationProvenance {
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
    if (requiresExactGenerationProvenance(input.destinationAssetType)) {
      throw new ProjectDataError(
        'CORE_GENERATION_ATTACHMENT_PROVENANCE_REQUIRED',
        'Shot Plan video generation attachments require exact frozen-spec or managed-run provenance.',
      );
    }
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
  const selectedOutput = run.outputs.find(
    (output) => output.projectRelativePath === input.sourceProjectRelativePath
  );
  if (!selectedOutput) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID', 'The attached source must be an exact output of the supplied generation run.');
  }
  return {
    kind: 'renku-managed',
    generationRunId,
    generationSpecId: run.specId,
    outputArtifactId: selectedOutput.artifactId,
  };
}

function requiresExactGenerationProvenance(assetType: string): boolean {
  return assetType === 'shot_plan_video' ||
    assetType === 'shot_plan_video_first_frame' ||
    assetType === 'shot_plan_video_last_frame' ||
    assetType === 'shot_plan_video_storyboard';
}

function validateAttachmentRequestMatch(
  input: AttachGenerationMediaInput & {
    session: DatabaseSession;
    destinationAssetType: string;
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
    destinationAssetType: input.destinationAssetType,
  });
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
