import type { MediaGenerationProjectContext } from '../../client/media-generation-context.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export function projectMediaGenerationContext(input: {
  session: DatabaseSession;
  projectName: string;
  projectId: string;
  projectFolder: string;
}): MediaGenerationProjectContext {
  const project = readProjectInformationResourceFromDatabase(input.session);
  return {
    projectName: input.projectName,
    id: input.projectId,
    projectFolder: input.projectFolder,
    title: project.title,
    aspectRatio: project.aspectRatio,
    ...(project.logline ? { logline: project.logline } : {}),
    ...(project.synopsis ? { synopsis: project.synopsis } : {}),
    ...(project.premise ? { premise: project.premise } : {}),
    ...(project.primaryGenre ? { primaryGenre: project.primaryGenre } : {}),
    ...(project.secondaryGenres ? { secondaryGenres: project.secondaryGenres } : {}),
    ...(project.tones ? { tones: project.tones } : {}),
    ...(project.themes ? { themes: project.themes } : {}),
    languages: listProjectLocaleRecords(input.session).map((locale) => ({
      id: locale.id,
      localeTag: locale.localeTag,
      ...(locale.displayName ? { displayName: locale.displayName } : {}),
      isBase: locale.isBase,
      supportsAudio: locale.supportsAudio,
      supportsSubtitles: locale.supportsSubtitles,
    })),
  };
}
