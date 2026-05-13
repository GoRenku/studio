import type { ProjectInformationResource } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import {
  projectSummaryRichTextRole,
  readRichTextAssetLink,
} from '../database/access/rich-text-asset-links.js';

export function readProjectInformationResource(
  session: DatabaseSession
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
