import type { ScreenplayStructureResource } from '../../../client/screenplay/index.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';
import { projectCanonicalScreenplayStructure } from '../projections/structure.js';

export async function readScreenplayStructure(
  input: RenkuConfigPathOptions & { projectName: string },
): Promise<ScreenplayStructureResource> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    return {
      screenplay,
      orderedSceneIds: projectCanonicalScreenplayStructure(screenplay).orderedSceneIds,
    };
  } finally {
    session.close();
  }
}
