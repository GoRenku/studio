import type {
  ProjectInfo,
  ProjectLanguage,
  ProjectShell,
  VisualLanguageCategory,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listCastNavigationPage,
  listContinuityReferenceNavigationPage,
  listEpisodeNavigationPage,
  listStandaloneMovieSequenceNavigationPage,
  listVisualLanguageNavigationPage,
  type ListNavigationPageInput,
} from '../database/access/navigation.js';
import { readProjectCounts } from '../database/access/project-counts.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import { listVisualLanguageCategoryRecords } from '../database/access/visual-language-categories.js';
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
    type: project.type === 'series' ? 'series' : 'standaloneMovie',
    folderPath: input.projectFolder,
    databasePath: session.databasePath,
    aspectRatio: nullable(project.aspectRatio),
    logline: nullable(project.logline),
  };
  const castPage = listCastNavigationPage(session, input);
  const visualLanguagePage = listVisualLanguageNavigationPage(session, input);
  const continuityPage = listContinuityReferenceNavigationPage(session, input);
  const counts = readProjectCounts(session);

  if (identity.type === 'series') {
    const episodePage = listEpisodeNavigationPage(session, input);
    return {
      identity,
      coverImage:
        project.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
      languages: listProjectLocaleRecords(session).map(toProjectLanguage),
      visualLanguageCategories: listVisualLanguageCategoryRecords(session).map(
        toVisualLanguageCategory
      ),
      visualLanguage: visualLanguagePage.items.map((row) => ({
        id: row.id,
        categoryId: row.categoryId,
        name: row.name,
        summary: row.oneLineSummary,
        priority: 'default',
      })),
      cast: castPage.items.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        role: row.role,
      })),
      continuityReferences: continuityPage.items.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        summary: row.oneLineSummary,
      })),
      counts,
      navigation: {
        cast: castPage,
        visualLanguage: visualLanguagePage,
        continuityReferences: continuityPage,
        screenplay: {
          projectType: 'series',
          episodes: episodePage,
        },
      },
    };
  }

  const sequencePage = listStandaloneMovieSequenceNavigationPage(session, input);
  return {
    identity,
    coverImage:
      project.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
    languages: listProjectLocaleRecords(session).map(toProjectLanguage),
    visualLanguageCategories: listVisualLanguageCategoryRecords(session).map(
      toVisualLanguageCategory
    ),
    visualLanguage: visualLanguagePage.items.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      summary: row.oneLineSummary,
      priority: 'default',
    })),
    cast: castPage.items.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      role: row.role,
    })),
    continuityReferences: continuityPage.items.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      summary: row.oneLineSummary,
    })),
    counts,
    navigation: {
      cast: castPage,
      visualLanguage: visualLanguagePage,
      continuityReferences: continuityPage,
      screenplay: {
        projectType: 'standaloneMovie',
        sequences: sequencePage,
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

function toVisualLanguageCategory(
  row: ReturnType<typeof listVisualLanguageCategoryRecords>[number]
): VisualLanguageCategory {
  return {
    id: row.id,
    name: row.name,
    description: nullable(row.description),
    source: row.source === 'system' ? 'system' : 'project',
  };
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
