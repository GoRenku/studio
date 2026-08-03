import type { ScreenplaySectionResource } from '../../../client/screenplay/index.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';
import { descendantSceneIds } from '../projections/structure.js';

export async function readScreenplaySection(
  input: RenkuConfigPathOptions & { projectName: string; sectionId: string },
): Promise<ScreenplaySectionResource> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    const section = screenplay.sections.find((value) => value.id === input.sectionId);
    if (!section) {
      throw new ProjectDataError(
        'SCREENPLAY_SECTION_NOT_FOUND',
        `Screenplay Section ${input.sectionId} does not exist.`,
      );
    }
    return {
      section,
      structure: screenplay.structure.filter((entry) =>
        entry.parentSectionId === input.sectionId
        || (entry.content.type === 'section' && entry.content.sectionId === input.sectionId)),
      orderedSceneIds: descendantSceneIds(screenplay, input.sectionId),
    };
  } finally {
    session.close();
  }
}
