import { and, desc, eq } from 'drizzle-orm';
import type {
  CastDesignDocument,
  CastDesignSummary,
  DepartmentDocumentSummary,
} from '../../../client/department-design.js';
import { assertCastDesignDocument } from '../../department-design-json/validator.js';
import { castDesigns, castDesignState } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  parseStoredDepartmentJson,
  readDepartmentDesignDocument,
  toDepartmentDesignSummaries,
} from './department-design-history.js';

export function listCastDesignRecords(
  session: DatabaseSession,
  castMemberId: string
): DepartmentDocumentSummary[] {
  const activeDesignId = readActiveCastDesignId(session, castMemberId);
  const rows = session.db
    .select()
    .from(castDesigns)
    .where(eq(castDesigns.castMemberId, castMemberId))
    .orderBy(desc(castDesigns.createdAt), desc(castDesigns.id))
    .all()
    .map((row) => ({ ...row, ownerId: row.castMemberId }));
  return toDepartmentDesignSummaries(rows, activeDesignId);
}

export function readActiveCastDesignId(
  session: DatabaseSession,
  castMemberId: string
): string | null {
  return session.db
    .select()
    .from(castDesignState)
    .where(eq(castDesignState.castMemberId, castMemberId))
    .get()?.activeDesignId ?? null;
}

export function readActiveCastDesignDocument(
  session: DatabaseSession,
  castMemberId: string
): { id: string; document: CastDesignDocument; summary: DepartmentDocumentSummary } | null {
  const activeDesignId = readActiveCastDesignId(session, castMemberId);
  return activeDesignId
    ? readCastDesignDocumentById(session, activeDesignId, castMemberId)
    : null;
}

export function readCastDesignDocumentById(
  session: DatabaseSession,
  designId: string,
  castMemberId?: string
): { id: string; document: CastDesignDocument; summary: DepartmentDocumentSummary } {
  const row = castMemberId
    ? session.db
        .select()
        .from(castDesigns)
        .where(and(eq(castDesigns.id, designId), eq(castDesigns.castMemberId, castMemberId)))
        .get()
    : session.db.select().from(castDesigns).where(eq(castDesigns.id, designId)).get();
  const ownerId = row?.castMemberId ?? castMemberId ?? '';
  return readDepartmentDesignDocument({
    row,
    ownerId,
    activeDesignId: readActiveCastDesignId(session, ownerId),
    label: 'Cast Design',
    parse: parseCastDesignDocument,
  });
}

export function writeCastDesignRecord(input: {
  session: DatabaseSession;
  id: string;
  document: CastDesignDocument;
  sourceCommand: string;
  now: string;
}): void {
  input.session.db.insert(castDesigns).values({
    id: input.id,
    castMemberId: input.document.castMemberId,
    documentJson: JSON.stringify(input.document),
    title: input.document.title ?? null,
    sourceCommand: input.sourceCommand,
    createdAt: input.now,
  }).run();
  setActiveCastDesignRecord(input.session, {
    castMemberId: input.document.castMemberId,
    designId: input.id,
    now: input.now,
  });
}

export function setActiveCastDesignRecord(
  session: DatabaseSession,
  input: { castMemberId: string; designId: string; now: string }
): void {
  readCastDesignDocumentById(session, input.designId, input.castMemberId);
  session.db.delete(castDesignState)
    .where(eq(castDesignState.castMemberId, input.castMemberId)).run();
  session.db.insert(castDesignState).values({
    castMemberId: input.castMemberId,
    activeDesignId: input.designId,
    updatedAt: input.now,
  }).run();
}

export function toCastDesignSummary(input: {
  id: string;
  document: CastDesignDocument;
}): CastDesignSummary {
  return {
    id: input.id,
    castMemberId: input.document.castMemberId,
    title: input.document.title ?? null,
    interpretation: input.document.design.interpretation.roleUnderstanding,
    appearance: [
      input.document.design.appearance.ageRead,
      input.document.design.appearance.build,
      input.document.design.appearance.face,
      input.document.design.appearance.posture,
      input.document.design.appearance.movement,
      input.document.design.appearance.grooming,
      input.document.design.appearance.silhouette,
    ].filter(isString),
    costume: [
      ...input.document.design.costume.baseWardrobeLogic,
      ...input.document.design.costume.variants.map((variant) => variant.label),
    ],
    voiceCasting: input.document.design.voiceCasting?.voiceIdentity ?? null,
    generationGuidance: [
      ...input.document.design.generationGuidance.characterSheetPositive,
      ...input.document.design.generationGuidance.profilePositive,
    ],
  };
}

function parseCastDesignDocument(
  documentJson: string,
  path: string[]
): CastDesignDocument {
  const document = parseStoredDepartmentJson(documentJson, path) as CastDesignDocument;
  assertCastDesignDocument({ document });
  return document;
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}
