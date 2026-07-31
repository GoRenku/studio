import { and, desc, eq } from 'drizzle-orm';
import type {
  DepartmentDocumentSummary,
  LocationDesignDocument,
  LocationDesignSummary,
} from '../../../client/department-design.js';
import { assertLocationDesignDocument } from '../../department-design-json/validator.js';
import { locationDesigns, locationDesignState } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  parseStoredDepartmentJson,
  readDepartmentDesignDocument,
  toDepartmentDesignSummaries,
} from './department-design-history.js';

export function listLocationDesignRecords(
  session: DatabaseSession,
  locationId: string
): DepartmentDocumentSummary[] {
  const activeDesignId = readActiveLocationDesignId(session, locationId);
  const rows = session.db.select().from(locationDesigns)
    .where(eq(locationDesigns.locationId, locationId))
    .orderBy(desc(locationDesigns.createdAt), desc(locationDesigns.id)).all()
    .map((row) => ({ ...row, ownerId: row.locationId }));
  return toDepartmentDesignSummaries(rows, activeDesignId);
}

export function readActiveLocationDesignId(
  session: DatabaseSession,
  locationId: string
): string | null {
  return session.db.select().from(locationDesignState)
    .where(eq(locationDesignState.locationId, locationId))
    .get()?.activeDesignId ?? null;
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
    ? session.db.select().from(locationDesigns)
        .where(and(eq(locationDesigns.id, designId), eq(locationDesigns.locationId, locationId))).get()
    : session.db.select().from(locationDesigns).where(eq(locationDesigns.id, designId)).get();
  const ownerId = row?.locationId ?? locationId ?? '';
  return readDepartmentDesignDocument({
    row,
    ownerId,
    activeDesignId: readActiveLocationDesignId(session, ownerId),
    label: 'Location Design',
    parse: parseLocationDesignDocument,
  });
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
  session.db.delete(locationDesignState)
    .where(eq(locationDesignState.locationId, input.locationId)).run();
  session.db.insert(locationDesignState).values({
    locationId: input.locationId,
    activeDesignId: input.designId,
    updatedAt: input.now,
  }).run();
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
    recurringObjects: input.document.design.recurringObjects.map(
      (recurringObject) => recurringObject.name
    ),
    locationSheetGuidance: input.document.design.locationSheetGuidance,
    generationGuidance: input.document.design.generationGuidance,
  };
}

function parseLocationDesignDocument(
  documentJson: string,
  path: string[]
): LocationDesignDocument {
  const document = parseStoredDepartmentJson(documentJson, path) as LocationDesignDocument;
  assertLocationDesignDocument({ document });
  return document;
}
