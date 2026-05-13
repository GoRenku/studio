import { count } from 'drizzle-orm';
import {
  castMembers,
  clips,
  continuityReferences,
  episodes,
  projectLocales,
  scenes,
  sequences,
  visualLanguage,
  visualLanguageCategories,
} from '../schema/index.js';
import type {
  ProjectCounts,
  ProjectInfo,
  ProjectLanguage,
  ProjectShell,
  VisualLanguageCategory,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listCastNavigationPage,
  listContinuityReferenceNavigationPage,
  listEpisodeNavigationPage,
  listStandaloneMovieSequenceNavigationPage,
  listVisualLanguageNavigationPage,
  type ListNavigationPageInput,
} from './navigation.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import { listVisualLanguageCategoryRecords } from '../database/access/visual-language-categories.js';

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
        narrative: {
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
      narrative: {
        projectType: 'standaloneMovie',
        sequences: sequencePage,
      },
    },
  };
}

function readProjectCounts(session: DatabaseSession): ProjectCounts {
  return {
    languages: countTable(session, projectLocales),
    visualLanguageCategories: countTable(session, visualLanguageCategories),
    visualLanguage: countTable(session, visualLanguage),
    castMembers: countTable(session, castMembers),
    continuityReferences: countTable(session, continuityReferences),
    episodes: countTable(session, episodes),
    sequences: countTable(session, sequences),
    scenes: countTable(session, scenes),
    clips: countTable(session, clips),
  };
}

function countTable(session: DatabaseSession, table: any): number {
  const row = session.db.select({ value: count() }).from(table).get();
  return row?.value ?? 0;
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
