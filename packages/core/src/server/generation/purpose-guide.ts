import type {
  GenerationGuideNotice,
  GenerationReferenceCatalogItem,
  GenerationReferenceGuide,
  GenerationReferenceGuideSection,
  GenerationReferenceGuideSlot,
} from '../../client/generation.js';
import { listGenerationReferences } from './references.js';
import type { BuildGenerationPurposeInput } from './purpose-contract.js';
import { and, eq, isNull } from 'drizzle-orm';
import { sceneDialogueAudio, sceneDialogueAudioTakes } from '../schema/index.js';
import type { LookbookKind } from '../../client/index.js';
import { readLookbookRecordByKind } from '../database/access/lookbook.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';
import { listGenerationReferenceAssetFileRecords } from '../database/access/generation-references.js';

export interface GuideSlotDefinition {
  sectionId: string;
  sectionLabel: string;
  slotId: string;
  slotLabel: string;
  guidance?: string;
  subject?: { kind: string; id: string };
  owner?: { kind: string; id: string };
  assetId?: string;
  assetFileIds?: string[];
  roles?: string[];
  mediaKind?: 'image' | 'audio' | 'video';
}

export function buildReferenceGuide(input: {
  context: BuildGenerationPurposeInput;
  slots?: GuideSlotDefinition[];
  notices?: GenerationGuideNotice[];
}): GenerationReferenceGuide {
  const sections = new Map<string, GenerationReferenceGuideSection>();
  for (const definition of input.slots ?? []) {
    const sectionKey = definition.sectionId;
    let section = sections.get(sectionKey);
    if (!section) {
      section = {
        id: definition.sectionId,
        label: definition.sectionLabel,
        slots: [],
      };
      sections.set(sectionKey, section);
    }
    section.slots.push(slotFromDefinition(input.context, definition));
  }
  return {
    sections: [...sections.values()],
    notices: input.notices ?? [],
  };
}

export function allImageCandidates(input: BuildGenerationPurposeInput) {
  return listGenerationReferences({ session: input.session, mediaKind: 'image', limit: 200 }).items;
}

function slotFromDefinition(
  context: BuildGenerationPurposeInput,
  definition: GuideSlotDefinition
): GenerationReferenceGuideSlot {
  const eligibleCandidates = listGenerationReferences({
    session: context.session,
    mediaKind: definition.mediaKind ?? 'image',
    ...(definition.owner ? { owner: definition.owner } : {}),
    ...(definition.assetId ? { assetId: definition.assetId } : {}),
    ...(definition.assetFileIds ? { assetFileIds: definition.assetFileIds } : {}),
    limit: 200,
  }).items.filter((candidate) => matchesRole(candidate, definition.roles));
  return {
    id: definition.slotId,
    label: definition.slotLabel,
    ...(definition.subject ? { subject: definition.subject } : {}),
    ...(definition.guidance ? { guidance: definition.guidance } : {}),
    eligibleCandidates,
  };
}

export function dialogueAudioFileIds(
  context: BuildGenerationPurposeInput,
  dialogueId: string
): string[] {
  return context.session.db
    .select({ assetFileId: sceneDialogueAudioTakes.assetFileId })
    .from(sceneDialogueAudioTakes)
    .innerJoin(sceneDialogueAudio, eq(sceneDialogueAudioTakes.sceneDialogueAudioId, sceneDialogueAudio.id))
    .where(and(eq(sceneDialogueAudio.dialogueId, dialogueId), isNull(sceneDialogueAudioTakes.discardedAt)))
    .all()
    .map((row) => row.assetFileId);
}

export function lookbookSheetFileIds(
  context: BuildGenerationPurposeInput,
  type: LookbookKind
): string[] {
  const lookbook = readLookbookRecordByKind(context.session, type);
  return lookbook
    ? listLookbookSheets(context.session, lookbook.id).flatMap((sheet) =>
        sheet.asset.files.map((file) => file.id)
      )
    : [];
}

export function domainAssetGroupsForRoles(
  context: BuildGenerationPurposeInput,
  ownerKind: 'castMember' | 'location',
  roles: string[]
): Array<{ owner: { kind: 'castMember' | 'location'; id: string }; assetFileIds: string[] }> {
  const filesByOwnerId = new Map<string, string[]>();
  for (const record of listGenerationReferenceAssetFileRecords(context.session)) {
    if (
      record.owner?.kind !== ownerKind ||
      !matchesOwnerRole(record.owner.role, roles)
    ) {
      continue;
    }
    const assetFileIds = filesByOwnerId.get(record.owner.id) ?? [];
    assetFileIds.push(record.file.id);
    filesByOwnerId.set(record.owner.id, assetFileIds);
  }
  return [...filesByOwnerId].map(([id, assetFileIds]) => ({
    owner: { kind: ownerKind, id },
    assetFileIds,
  }));
}

function matchesRole(
  candidate: GenerationReferenceCatalogItem,
  roles: string[] | undefined
): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }
  const normalized = candidate.role.replaceAll('_', '-').toLocaleLowerCase();
  return roles.some((role) => normalized === role.replaceAll('_', '-').toLocaleLowerCase());
}

function matchesOwnerRole(ownerRole: string, roles: string[]): boolean {
  const normalized = ownerRole.replaceAll('_', '-').toLocaleLowerCase();
  return roles.some((role) => normalized === role.replaceAll('_', '-').toLocaleLowerCase());
}
