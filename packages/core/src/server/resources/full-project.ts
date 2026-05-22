import { ProjectDataError } from '../project-data-error.js';
import type {
  CastMember,
  Location,
  Project,
  ProjectInfo,
  ProjectLanguage,
  Scene,
  Sequence,
  VisualLanguage,
  VisualLanguageCategory,
} from '../../client/index.js';
import type { Location as ScreenplayLocation } from '../../client/screenplay.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import {
  listCastMemberRecords,
  type CastMemberRecord,
} from '../database/access/cast-members.js';
import { readProjectCounts } from '../database/access/project-counts.js';
import {
  listSceneRecords,
  listSequenceRecords,
  type SceneRecord,
  type SequenceRecord,
} from '../database/access/screenplay-projection.js';
import {
  listProjectLocaleRecords,
  type ProjectLocaleRecord,
} from '../database/access/project-locales.js';
import { readProjectRecord, type ProjectRecord } from '../database/access/project.js';
import {
  listVisualLanguageCategoryRecords,
  type VisualLanguageCategoryRecord,
} from '../database/access/visual-language-categories.js';
import {
  listVisualLanguageRecords,
  type VisualLanguageRecord,
} from '../database/access/visual-language.js';
import { listScreenplayLocationsFromSession } from '../database/access/screenplay-resource.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export async function readProject(input: ReadProjectInput): Promise<Project> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({
    projectFolder,
    create: false,
    lifetime: 'project',
  });
  try {
    return readProjectFromSession({ session, projectFolder });
  } finally {
    session.close();
  }
}

export function readProjectFromSession(input: {
  session: DatabaseSession;
  projectFolder: string;
}): Project {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${input.session.databasePath}.`
    );
  }

  const languages = listProjectLocaleRecords(input.session).map(toProjectLanguage);
  const visualLanguageCategories = listVisualLanguageCategoryRecords(input.session).map(
    toVisualLanguageCategory
  );
  const visualLanguage = listVisualLanguageRecords(input.session).map((row) =>
    toVisualLanguage(row)
  );
  const cast = listCastMemberRecords(input.session).map(toCastMember);
  const locations = listScreenplayLocationsFromSession(input.session).map(
    toProjectLocation
  );
  const sequenceRecords = listSequenceRecords(input.session);
  const sceneRecords = listSceneRecords(input.session);

  const sequences = buildSequences(sequenceRecords, sceneRecords);
  const counts = readProjectCounts(input.session);

  return {
    identity: toProjectInfo(
      project,
      input.projectFolder,
      input.session.databasePath
    ),
    coverImage: project.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
    languages,
    visualLanguageCategories,
    visualLanguage,
    cast,
    locations,
    sequences,
    counts,
  };
}

function buildSequences(
  sequenceRecords: SequenceRecord[],
  sceneRecords: SceneRecord[]
): Sequence[] {
  return sequenceRecords.map((sequence, sequenceIndex) => ({
    id: sequence.id,
    number: sequenceIndex + 1,
    title: sequence.title,
    shortTitle: nullable(sequence.shortTitle),
    summary: nonEmpty(sequence.oneLineSummary ?? undefined),
    scenes: sceneRecords
      .filter((scene) => scene.sequenceId === sequence.id)
      .map(toScene),
  }));
}

function toProjectInfo(
  row: ProjectRecord,
  folderPath: string,
  databasePath: string
): ProjectInfo {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    folderPath,
    databasePath,
    aspectRatio: nullable(row.aspectRatio),
    logline: nullable(row.logline),
    summary: nonEmpty(row.summary ?? undefined),
  };
}

function toProjectLanguage(row: ProjectLocaleRecord): ProjectLanguage {
  return {
    id: row.id,
    localeTag: row.localeTag,
    displayName: nullable(row.displayName),
    isBase: row.isBase,
    supportsAudio: row.supportsAudio,
    supportsSubtitles: row.supportsSubtitles,
  };
}

function toVisualLanguageCategory(
  row: VisualLanguageCategoryRecord
): VisualLanguageCategory {
  return {
    id: row.id,
    name: row.name,
    description: nullable(row.description),
    source: row.source === 'system' ? 'system' : 'project',
  };
}

function toVisualLanguage(row: VisualLanguageRecord): VisualLanguage {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    summary: nullable(row.oneLineSummary),
    priority:
      row.priority === 'situational' || row.priority === 'rare'
        ? row.priority
        : 'default',
  };
}

function toCastMember(row: CastMemberRecord): CastMember {
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

function toProjectLocation(row: ScreenplayLocation): Location {
  if (!row.id) {
    throw new ProjectDataError(
      'PROJECT_DATA205',
      `Screenplay location is missing a durable id: ${row.handle}.`,
      {
        suggestion:
          'Recreate or repair the screenplay data before reading project context.',
      }
    );
  }
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    timePeriod: row.timePeriod,
    description: row.description,
    visualNotes: row.visualNotes,
  };
}

function toScene(row: SceneRecord): Scene {
  return {
    id: row.id,
    title: row.title,
    summary: nonEmpty(row.oneLineSummary ?? undefined),
  };
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}
