import { asc } from 'drizzle-orm';
import type {
  ScreenplayReference,
  ScreenplayReferenceTarget,
  ScreenplaySubject,
} from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  castMembers,
  locations,
  props,
  screenplayReferences,
} from '../../schema/index.js';
import type { ScreenplaySubjectIds } from '../validation/references.js';

export function readReferenceRecords(
  session: DatabaseSession,
): ScreenplayReference[] {
  return session.db
    .select()
    .from(screenplayReferences)
    .orderBy(asc(screenplayReferences.id))
    .all()
    .map((row) => ({
      id: row.id,
      subject: readSubject(row),
      target: readTarget(row),
      role: row.role as ScreenplayReference['role'],
      ...(row.rangeStart !== null && row.rangeLength !== null
        ? { range: { start: row.rangeStart, length: row.rangeLength } }
        : {}),
    }));
}

export function replaceReferenceRecords(
  session: DatabaseSession,
  values: ScreenplayReference[],
): void {
  session.db.delete(screenplayReferences).run();
  for (const reference of values) {
    session.db.insert(screenplayReferences).values({
      id: reference.id,
      subjectType: reference.subject.type,
      castMemberId: reference.subject.type === 'castMember' ? reference.subject.id : null,
      locationId: reference.subject.type === 'location' ? reference.subject.id : null,
      propId: reference.subject.type === 'prop' ? reference.subject.id : null,
      targetType: reference.target.type,
      openingElementId: reference.target.type === 'openingElement'
        ? reference.target.elementId
        : null,
      sceneId: 'sceneId' in reference.target ? reference.target.sceneId : null,
      blockId: reference.target.type === 'block' ? reference.target.blockId : null,
      turnId: reference.target.type === 'dialogueCue' || reference.target.type === 'dialoguePart'
        ? reference.target.turnId
        : null,
      partId: reference.target.type === 'dialoguePart' ? reference.target.partId : null,
      role: reference.role,
      rangeStart: reference.range?.start ?? null,
      rangeLength: reference.range?.length ?? null,
    }).run();
  }
}

export function readScreenplaySubjectIds(
  session: DatabaseSession,
): ScreenplaySubjectIds {
  return {
    castMemberIds: new Set(session.db.select({ id: castMembers.id }).from(castMembers).all().map((row) => row.id)),
    locationIds: new Set(session.db.select({ id: locations.id }).from(locations).all().map((row) => row.id)),
    propIds: new Set(session.db.select({ id: props.id }).from(props).all().map((row) => row.id)),
  };
}

type ReferenceRow = typeof screenplayReferences.$inferSelect;

function readSubject(row: ReferenceRow): ScreenplaySubject {
  if (row.subjectType === 'castMember') {
    return { type: 'castMember', id: required(row.castMemberId) };
  }
  if (row.subjectType === 'location') {
    return { type: 'location', id: required(row.locationId) };
  }
  return { type: 'prop', id: required(row.propId) };
}

function readTarget(row: ReferenceRow): ScreenplayReferenceTarget {
  switch (row.targetType) {
    case 'openingElement': return { type: 'openingElement', elementId: required(row.openingElementId) };
    case 'scene': return { type: 'scene', sceneId: required(row.sceneId) };
    case 'sceneHeading': return { type: 'sceneHeading', sceneId: required(row.sceneId) };
    case 'block': return { type: 'block', sceneId: required(row.sceneId), blockId: required(row.blockId) };
    case 'dialogueCue': return { type: 'dialogueCue', sceneId: required(row.sceneId), turnId: required(row.turnId) };
    case 'dialoguePart': return {
      type: 'dialoguePart',
      sceneId: required(row.sceneId),
      turnId: required(row.turnId),
      partId: required(row.partId),
    };
    default: {
      throw invalidStoredReference(`Stored Screenplay reference target is invalid: ${row.targetType}.`);
    }
  }
}

function required(value: string | null): string {
  if (value === null) {
    throw invalidStoredReference('Stored Screenplay reference row is incomplete.');
  }
  return value;
}

function invalidStoredReference(message: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA201',
    message,
    { suggestion: 'Repair the stored Screenplay reference row before reading this project.' },
  );
}
