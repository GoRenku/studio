import { and, desc, eq } from 'drizzle-orm';
import type {
  CastDesignDocument,
  CastDesignSummary,
  DepartmentDocumentSummary,
  LocationDesignDocument,
  LocationDesignSummary,
} from '../../../client/department-design.js';
import {
  castDesigns,
  castDesignState,
  locationDesigns,
  locationDesignState,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  assertCastDesignDocument,
  assertLocationDesignDocument,
} from '../../department-design-json/validator.js';

export type CastDesignRecord = typeof castDesigns.$inferSelect;
export type LocationDesignRecord = typeof locationDesigns.$inferSelect;

export function listCastDesignRecords(
  session: DatabaseSession,
  castMemberId: string
): DepartmentDocumentSummary[] {
  const activeDesignId = readActiveCastDesignId(session, castMemberId);
  return session.db
    .select()
    .from(castDesigns)
    .where(eq(castDesigns.castMemberId, castMemberId))
    .orderBy(desc(castDesigns.createdAt), desc(castDesigns.id))
    .all()
    .map((row) => toSummary(row, row.castMemberId, row.id === activeDesignId));
}

export function readActiveCastDesignId(
  session: DatabaseSession,
  castMemberId: string
): string | null {
  return (
    session.db
      .select()
      .from(castDesignState)
      .where(eq(castDesignState.castMemberId, castMemberId))
      .get()?.activeDesignId ?? null
  );
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
  if (!row) {
    throwDepartmentDocumentNotFound('Cast Design');
  }
  const document = parseCastDesignDocument(row.documentJson, ['castDesign', row.id]);
  return {
    id: row.id,
    document,
    summary: toSummary(row, row.castMemberId, row.id === readActiveCastDesignId(session, row.castMemberId)),
  };
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
  session.db
    .delete(castDesignState)
    .where(eq(castDesignState.castMemberId, input.castMemberId))
    .run();
  session.db.insert(castDesignState).values({
    castMemberId: input.castMemberId,
    activeDesignId: input.designId,
    updatedAt: input.now,
  }).run();
}

export function listLocationDesignRecords(
  session: DatabaseSession,
  locationId: string
): DepartmentDocumentSummary[] {
  const activeDesignId = readActiveLocationDesignId(session, locationId);
  return session.db
    .select()
    .from(locationDesigns)
    .where(eq(locationDesigns.locationId, locationId))
    .orderBy(desc(locationDesigns.createdAt), desc(locationDesigns.id))
    .all()
    .map((row) => toSummary(row, row.locationId, row.id === activeDesignId));
}

export function readActiveLocationDesignId(
  session: DatabaseSession,
  locationId: string
): string | null {
  return (
    session.db
      .select()
      .from(locationDesignState)
      .where(eq(locationDesignState.locationId, locationId))
      .get()?.activeDesignId ?? null
  );
}

export function readActiveLocationDesignDocument(
  session: DatabaseSession,
  locationId: string
): { id: string; document: LocationDesignDocument; summary: DepartmentDocumentSummary } | null {
  const activeDesignId = readActiveLocationDesignId(session, locationId);
  return activeDesignId
    ? readLocationDesignDocumentById(session, activeDesignId, locationId)
    : null;
}

export function readLocationDesignDocumentById(
  session: DatabaseSession,
  designId: string,
  locationId?: string
): { id: string; document: LocationDesignDocument; summary: DepartmentDocumentSummary } {
  const row = locationId
    ? session.db
        .select()
        .from(locationDesigns)
        .where(and(eq(locationDesigns.id, designId), eq(locationDesigns.locationId, locationId)))
        .get()
    : session.db.select().from(locationDesigns).where(eq(locationDesigns.id, designId)).get();
  if (!row) {
    throwDepartmentDocumentNotFound('Location Design');
  }
  const document = parseLocationDesignDocument(row.documentJson, [
    'locationDesign',
    row.id,
  ]);
  return {
    id: row.id,
    document,
    summary: toSummary(row, row.locationId, row.id === readActiveLocationDesignId(session, row.locationId)),
  };
}

export function writeLocationDesignRecord(input: {
  session: DatabaseSession;
  id: string;
  document: LocationDesignDocument;
  sourceCommand: string;
  now: string;
}): void {
  input.session.db.insert(locationDesigns).values({
    id: input.id,
    locationId: input.document.locationId,
    documentJson: JSON.stringify(input.document),
    title: input.document.title ?? null,
    sourceCommand: input.sourceCommand,
    createdAt: input.now,
  }).run();
  setActiveLocationDesignRecord(input.session, {
    locationId: input.document.locationId,
    designId: input.id,
    now: input.now,
  });
}

export function setActiveLocationDesignRecord(
  session: DatabaseSession,
  input: { locationId: string; designId: string; now: string }
): void {
  readLocationDesignDocumentById(session, input.designId, input.locationId);
  session.db
    .delete(locationDesignState)
    .where(eq(locationDesignState.locationId, input.locationId))
    .run();
  session.db.insert(locationDesignState).values({
    locationId: input.locationId,
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

export function toLocationDesignSummary(input: {
  id: string;
  document: LocationDesignDocument;
}): LocationDesignSummary {
  return {
    id: input.id,
    locationId: input.document.locationId,
    title: input.document.title ?? null,
    spatialThesis: input.document.design.spatialThesis,
    architecture: input.document.design.architecture,
    setDressing: input.document.design.setDressing,
    props: input.document.design.propsAndRecurringObjects.map((prop) => prop.name),
    locationSheetGuidance: input.document.design.locationSheetGuidance,
    generationGuidance: input.document.design.generationGuidance,
  };
}

function parseCastDesignDocument(
  documentJson: string,
  path: string[]
): CastDesignDocument {
  const document = parseStoredJson(documentJson, path) as CastDesignDocument;
  assertCastDesignDocument({ document });
  return document;
}

function parseLocationDesignDocument(
  documentJson: string,
  path: string[]
): LocationDesignDocument {
  const document = parseStoredJson(documentJson, path) as LocationDesignDocument;
  assertLocationDesignDocument({ document });
  return document;
}

function parseStoredJson(documentJson: string, path: string[]): unknown {
  try {
    return JSON.parse(documentJson);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA200',
      'Stored department document JSON is malformed.',
      {
        suggestion: `Repair the stored department document at ${path.join('.')}.`,
      }
    );
  }
}

function toSummary(
  row: {
    id: string;
    title: string | null;
    createdAt: string;
    sourceCommand: string | null;
  },
  ownerId: string,
  isActive: boolean
): DepartmentDocumentSummary {
  return {
    id: row.id,
    ownerId,
    title: row.title,
    createdAt: row.createdAt,
    isActive,
    sourceCommand: row.sourceCommand,
  };
}

function throwDepartmentDocumentNotFound(label: string): never {
  throw new ProjectDataError('PROJECT_DATA205', `${label} was not found.`, {
    suggestion: 'Check the id from the latest department list command.',
  });
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}
