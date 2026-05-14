import type { ProjectInformationResource } from '../../../client/index.js';
import type { ProjectInformationUpdate } from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import { readProjectRecord } from './project.js';
import { listProjectLocaleRecords } from './project-locales.js';
import {
  projectSummaryRichTextRole,
  readRichTextAssetLink,
} from './rich-text-asset-links.js';

export function readProjectInformationResourceFromDatabase(
  session: DatabaseSession
): ProjectInformationResource {
  const project = readRequiredProjectRecord(session);
  return {
    title: project.title,
    aspectRatio: project.aspectRatio ?? undefined,
    logline: project.logline ?? undefined,
    summaryAsset: readRichTextAssetLink(session, {
      target: { kind: 'project' },
      role: 'summary',
      relationshipLabel: 'project',
      richTextRoles: projectSummaryRichTextRole(),
    }),
    languages: listProjectLocaleRecords(session).map((row) => ({
      id: row.id,
      localeTag: row.localeTag,
      displayName: row.displayName ?? undefined,
      isBase: row.isBase,
      supportsAudio: row.supportsAudio,
      supportsSubtitles: row.supportsSubtitles,
    })),
  };
}

export function readProjectInformationUpdateFromDatabase(
  session: DatabaseSession
): ProjectInformationUpdate {
  const project = readRequiredProjectRecord(session);
  return {
    title: project.title,
    aspectRatio: project.aspectRatio ?? undefined,
    logline: project.logline ?? undefined,
    languages: listProjectLocaleRecords(session).map((row) => ({
      localeTag: row.localeTag,
      displayName: row.displayName ?? undefined,
      isBase: row.isBase,
      supportsAudio: row.supportsAudio,
      supportsSubtitles: row.supportsSubtitles,
    })),
  };
}

function readRequiredProjectRecord(
  session: DatabaseSession
): NonNullable<ReturnType<typeof readProjectRecord>> {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}
