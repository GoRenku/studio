import { asc, eq } from 'drizzle-orm';
import type {
  Act,
  Block,
  CastMember,
  Location,
  Scene,
  Screenplay,
  ScreenplayDocument,
  Sequence,
} from '../../../client/screenplay.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  acts,
  castMembers,
  locations,
  sceneLocations,
  scenes,
  screenplay,
  sequences,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { validateScreenplayStoredJsonFragment } from '../../screenplay-json/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function listScreenplayCastMembersFromSession(session: DatabaseSession): CastMember[] {
  return session.db.select().from(castMembers).orderBy(asc(castMembers.position)).all().map(toCastMember);
}

export function readScreenplayCastMemberFromSession(
  session: DatabaseSession,
  castMemberId: string
): CastMember {
  return toCastMember(required(session.db.select().from(castMembers).where(eq(castMembers.id, castMemberId)).get(), 'cast member'));
}

export function listScreenplayLocationsFromSession(session: DatabaseSession): Location[] {
  return session.db.select().from(locations).orderBy(asc(locations.position)).all().map(toLocation);
}

export function readScreenplayLocationFromSession(
  session: DatabaseSession,
  locationId: string
): Location {
  return toLocation(required(session.db.select().from(locations).where(eq(locations.id, locationId)).get(), 'location'));
}

export function listScreenplayActsFromSession(session: DatabaseSession): Act[] {
  return session.db.select().from(acts).orderBy(asc(acts.position)).all().map(toActWithoutSequences);
}

export function readScreenplayActFromSession(session: DatabaseSession, actId: string): Act {
  const document = required(readScreenplayDocumentFromSession(session), 'screenplay');
  return required(document.acts.find((act) => act.id === actId), 'act');
}

export function listScreenplaySequencesForActFromSession(
  session: DatabaseSession,
  actId: string
): Sequence[] {
  return session.db
    .select()
    .from(sequences)
    .where(eq(sequences.actId, actId))
    .orderBy(asc(sequences.position))
    .all()
    .map(toSequenceWithoutScenes);
}

export function readScreenplaySequenceFromSession(
  session: DatabaseSession,
  sequenceId: string
): Sequence {
  const document = required(readScreenplayDocumentFromSession(session), 'screenplay');
  for (const act of document.acts) {
    const sequence = act.sequences.find((candidate) => candidate.id === sequenceId);
    if (sequence) {
      return sequence;
    }
  }
  throwNotFound('sequence');
}

export function listScreenplayScenesForSequenceFromSession(
  session: DatabaseSession,
  sequenceId: string
): Scene[] {
  return buildScenes(session, sequenceId);
}

export function readScreenplaySceneFromSession(
  session: DatabaseSession,
  sceneId: string
): Scene {
  const scene = session.db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  return buildScene(session, required(scene, 'scene'));
}

export function readScreenplayDocumentFromSession(session: DatabaseSession): ScreenplayDocument | null {
  const screenplayRow = session.db.select().from(screenplay).get();
  if (!screenplayRow) {
    return null;
  }
  const sequenceRows = session.db.select().from(sequences).orderBy(asc(sequences.position)).all();
  return {
    kind: 'screenplay',
    screenplay: toScreenplay(screenplayRow),
    cast: session.db.select().from(castMembers).orderBy(asc(castMembers.position)).all().map(toCastMember),
    locations: session.db.select().from(locations).orderBy(asc(locations.position)).all().map(toLocation),
    acts: session.db
      .select()
      .from(acts)
      .orderBy(asc(acts.position))
      .all()
      .map((actRow) => ({
        ...toActWithoutSequences(actRow),
        sequences: sequenceRows
          .filter((sequenceRow) => sequenceRow.actId === actRow.id)
          .map((sequenceRow) => ({
            ...toSequenceWithoutScenes(sequenceRow),
            scenes: buildScenes(session, sequenceRow.id),
          })),
      })),
  };
}

function buildScenes(session: DatabaseSession, sequenceId: string): Scene[] {
  return session.db
    .select()
    .from(scenes)
    .where(eq(scenes.sequenceId, sequenceId))
    .orderBy(asc(scenes.position))
    .all()
    .map((scene) => buildScene(session, scene));
}

function buildScene(session: DatabaseSession, scene: typeof scenes.$inferSelect): Scene {
  const locationIds = session.db
    .select()
    .from(sceneLocations)
    .where(eq(sceneLocations.sceneId, scene.id))
    .orderBy(asc(sceneLocations.position))
    .all()
    .map((row) => row.locationId);
  return {
    id: scene.id,
    title: scene.title,
    setting: {
      interiorExterior: nullable(scene.interiorExterior),
      timeOfDay: nullable(scene.timeOfDay),
      locationIds,
    },
    storyFunction: parseStringArray(scene.storyFunction, ['scenes', scene.id, 'storyFunction']),
    blocks: parseBlocks(scene.blocksJson, ['scenes', scene.id, 'blocks']),
  };
}

function toScreenplay(row: typeof screenplay.$inferSelect): Screenplay {
  return {
    title: row.title,
    intendedAudience: nullable(row.intendedAudience),
    targetLengthLabel: nullable(row.targetLengthLabel),
    estimatedMinutes: row.estimatedMinutes ?? undefined,
    genrePrimary: nullable(row.genrePrimary),
    genreSecondary: parseStringArray(row.genreSecondary, ['screenplay', 'genreSecondary']),
    tone: parseStringArray(row.tone, ['screenplay', 'tone']),
    ratingIntent: nullable(row.ratingIntent),
    boundaries: parseStringArray(row.boundaries, ['screenplay', 'boundaries']),
    logline: nullable(row.logline),
    summary: nullable(row.summary),
    premiseOverview: nullable(row.premiseOverview),
    centralConflict: nullable(row.centralConflict),
    dramaticQuestion: nullable(row.dramaticQuestion),
    themes: parseStringArray(row.themes, ['screenplay', 'themes']),
    historicalBasis: parseStringArray(row.historicalBasis, ['screenplay', 'historicalBasis']),
    dramatizedElements: parseStringArray(row.dramatizedElements, [
      'screenplay',
      'dramatizedElements',
    ]),
    status: nullable(row.status),
    researchSources: parseStringArray(row.researchSources, ['screenplay', 'researchSources']),
    assumptionsMade: parseStringArray(row.assumptionsMade, ['screenplay', 'assumptionsMade']),
  };
}

function toCastMember(row: typeof castMembers.$inferSelect): CastMember {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    role: nullable(row.role),
    age: row.age ?? undefined,
    want: nullable(row.want),
    need: nullable(row.need),
    arc: nullable(row.arc),
    voiceNotes: nullable(row.voiceNotes),
    description: nullable(row.description),
  };
}

function toLocation(row: typeof locations.$inferSelect): Location {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    timePeriod: nullable(row.timePeriod),
    description: nullable(row.description),
    visualNotes: nullable(row.visualNotes),
  };
}

function toActWithoutSequences(row: typeof acts.$inferSelect): Act {
  return {
    id: row.id,
    title: row.title,
    purpose: nullable(row.purpose),
    sequences: [],
  };
}

function toSequenceWithoutScenes(row: typeof sequences.$inferSelect): Sequence {
  return {
    id: row.id,
    title: row.title,
    purpose: nullable(row.purpose),
    scenes: [],
  };
}

function parseStoredJson(value: string, path: string[]): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new ProjectDataError('PROJECT_DATA200', 'Stored screenplay JSON is malformed.', {
      issues: [
        createDiagnosticError(
          'PROJECT_DATA200',
          'Stored screenplay JSON is malformed.',
          { path },
          'Repair the stored screenplay data before reading it.'
        ),
      ],
      suggestion: 'Repair the stored screenplay data before reading it.',
    });
  }
}

function parseStringArray(value: string | null, path: string[]): string[] {
  if (!value) {
    return [];
  }
  const parsed = parseStoredJson(value, path);
  validateScreenplayStoredJsonFragment({
    value: parsed,
    fragment: 'stringArray',
    path,
  });
  return parsed as string[];
}

function parseBlocks(value: string, path: string[]): Block[] {
  const parsed = parseStoredJson(value, path);
  validateScreenplayStoredJsonFragment({
    value: parsed,
    fragment: 'blockArray',
    path,
  });
  return parsed as Block[];
}

function nullable(value: string | null): string | undefined {
  return value ?? undefined;
}

function required<T>(value: T | null | undefined, label: string): T {
  if (!value) {
    throwNotFound(label);
  }
  return value;
}

function throwNotFound(label: string): never {
  throw new ProjectDataError('PROJECT_DATA205', `No ${label} was found for this screenplay request.`, {
    suggestion: 'Check the id from the latest screenplay read command.',
  });
}
