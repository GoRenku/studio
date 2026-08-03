import type { ProjectLanguage, ProjectShell } from '../../client/index.js';
import {
  listCastNavigationPage,
  listLocationNavigationPage,
  listPropNavigationPage,
  type ListNavigationPageInput,
} from '../database/access/navigation.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import { readProjectFromSession } from './full-project.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { projectCanonicalScreenplayStructure } from '../screenplay/projections/structure.js';

export async function readProjectShell(input: ReadProjectInput): Promise<ProjectShell> {
  const { session } = await openProjectSession(input);
  try {
    return readProjectShellProjection(session, {});
  } finally {
    session.close();
  }
}

export function readProjectShellProjection(
  session: DatabaseSession,
  input: { projectFolder?: string } & ListNavigationPageInput,
): ProjectShell {
  const screenplay = readCanonicalScreenplay(session);
  return {
    project: readProjectFromSession({ session }),
    languages: listProjectLocaleRecords(session).map(toProjectLanguage),
    navigation: {
      cast: listCastNavigationPage(session, input),
      locations: listLocationNavigationPage(session, input),
      props: listPropNavigationPage(session, input),
      screenplay: {
        screenplay,
        orderedSceneIds: projectCanonicalScreenplayStructure(screenplay).orderedSceneIds,
      },
    },
  };
}

function toProjectLanguage(
  row: ReturnType<typeof listProjectLocaleRecords>[number],
): ProjectLanguage {
  return {
    id: row.id,
    localeTag: row.localeTag,
    displayName: row.displayName ?? undefined,
    isBase: row.isBase,
    supportsAudio: row.supportsAudio,
    supportsSubtitles: row.supportsSubtitles,
  };
}
