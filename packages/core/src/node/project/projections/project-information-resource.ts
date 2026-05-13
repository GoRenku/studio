import type { ProjectInformationResource } from '../../../project/index.js';
import { ProjectDataError } from '../../../project/index.js';
import type { ProjectDataSession } from '../data/sqlite-project-store.js';
import { readProjectRecord } from '../data/project-records.js';
import { listProjectLocaleRecords } from '../data/project-locale-records.js';
import {
  projectSummaryRichTextRole,
  readRichTextAssetLink,
} from '../data/rich-text-asset-links.js';

export function readProjectInformationResource(
  session: ProjectDataSession
): ProjectInformationResource {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
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
