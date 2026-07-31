import { and, desc, eq } from 'drizzle-orm';
import type {
  DepartmentDocumentSummary,
  PropDesignDocument,
  PropDesignSummary,
} from '../../../client/department-design.js';
import { assertPropDesignDocument } from '../../department-design-json/validator.js';
import { propDesigns, propDesignState } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  parseStoredDepartmentJson,
  readDepartmentDesignDocument,
  toDepartmentDesignSummaries,
} from './department-design-history.js';

export function listPropDesignRecords(
  session: DatabaseSession,
  propId: string
): DepartmentDocumentSummary[] {
  const activeDesignId = readActivePropDesignId(session, propId);
  const rows = session.db.select().from(propDesigns)
    .where(eq(propDesigns.propId, propId))
    .orderBy(desc(propDesigns.createdAt), desc(propDesigns.id)).all()
    .map((row) => ({ ...row, ownerId: row.propId }));
  return toDepartmentDesignSummaries(rows, activeDesignId);
}

export function readActivePropDesignId(
  session: DatabaseSession,
  propId: string
): string | null {
  return session.db.select().from(propDesignState)
    .where(eq(propDesignState.propId, propId))
    .get()?.activeDesignId ?? null;
}

export function readActivePropDesignDocument(
  session: DatabaseSession,
  propId: string
): { id: string; document: PropDesignDocument; summary: DepartmentDocumentSummary } | null {
  const activeDesignId = readActivePropDesignId(session, propId);
  return activeDesignId ? readPropDesignDocumentById(session, activeDesignId, propId) : null;
}

export function readPropDesignDocumentById(
  session: DatabaseSession,
  designId: string,
  propId?: string
): { id: string; document: PropDesignDocument; summary: DepartmentDocumentSummary } {
  const row = propId
    ? session.db.select().from(propDesigns)
        .where(and(eq(propDesigns.id, designId), eq(propDesigns.propId, propId))).get()
    : session.db.select().from(propDesigns).where(eq(propDesigns.id, designId)).get();
  const ownerId = row?.propId ?? propId ?? '';
  return readDepartmentDesignDocument({
    row,
    ownerId,
    activeDesignId: readActivePropDesignId(session, ownerId),
    label: 'Prop Design',
    parse: parsePropDesignDocument,
  });
}

export function writePropDesignRecord(input: {
  session: DatabaseSession;
  id: string;
  document: PropDesignDocument;
  sourceCommand: string;
  now: string;
}): void {
  input.session.db.insert(propDesigns).values({
    id: input.id,
    propId: input.document.propId,
    documentJson: JSON.stringify(input.document),
    title: input.document.title ?? null,
    sourceCommand: input.sourceCommand,
    createdAt: input.now,
  }).run();
  setActivePropDesignRecord(input.session, {
    propId: input.document.propId,
    designId: input.id,
    now: input.now,
  });
}

export function setActivePropDesignRecord(
  session: DatabaseSession,
  input: { propId: string; designId: string; now: string }
): void {
  readPropDesignDocumentById(session, input.designId, input.propId);
  session.db.delete(propDesignState).where(eq(propDesignState.propId, input.propId)).run();
  session.db.insert(propDesignState).values({
    propId: input.propId,
    activeDesignId: input.designId,
    updatedAt: input.now,
  }).run();
}

export function toPropDesignSummary(input: {
  id: string;
  document: PropDesignDocument;
}): PropDesignSummary {
  return {
    id: input.id,
    propId: input.document.propId,
    title: input.document.title ?? null,
    ...input.document.design,
  };
}

function parsePropDesignDocument(
  documentJson: string,
  path: string[]
): PropDesignDocument {
  const document = parseStoredDepartmentJson(documentJson, path) as PropDesignDocument;
  assertPropDesignDocument({ document });
  return document;
}
