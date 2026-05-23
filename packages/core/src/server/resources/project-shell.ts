import type {
  ProjectInfo,
  ProjectLanguage,
  ProjectShell,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listCastNavigationPage,
  listActNavigationPage,
  listLocationNavigationPage,
  type ListNavigationPageInput,
} from '../database/access/navigation.js';
import { readProjectCounts } from '../database/access/project-counts.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';

export async function readProjectShell(input: ReadProjectInput): Promise<ProjectShell> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    return readProjectShellProjection(session, {
      projectFolder,
    });
  } finally {
    session.close();
  }
}

export function readProjectShellProjection(
  session: DatabaseSession,
  input: { projectFolder: string } & ListNavigationPageInput
): ProjectShell {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }

  const identity: ProjectInfo = {
    id: project.id,
    name: project.name,
    title: project.title,
    folderPath: input.projectFolder,
    databasePath: session.databasePath,
    aspectRatio: nullable(project.aspectRatio),
    logline: nullable(project.logline),
    summary: nullable(project.summary),
  };
  const castPage = listCastNavigationPage(session, input);
  const locationPage = listLocationNavigationPage(session, input);
  const counts = readProjectCounts(session);

  const actPage = listActNavigationPage(session, input);
  return {
    identity,
    coverImage:
      project.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
    languages: listProjectLocaleRecords(session).map(toProjectLanguage),
    cast: castPage.items.map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      role: row.role,
    })),
    counts,
    navigation: {
      cast: castPage,
      locations: locationPage,
      screenplay: {
        acts: actPage,
      },
    },
  };
}

function toProjectLanguage(row: ReturnType<typeof listProjectLocaleRecords>[number]): ProjectLanguage {
  return {
    id: row.id,
    localeTag: row.localeTag,
    displayName: nullable(row.displayName),
    isBase: row.isBase,
    supportsAudio: row.supportsAudio,
    supportsSubtitles: row.supportsSubtitles,
  };
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
