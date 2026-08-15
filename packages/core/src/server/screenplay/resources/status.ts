import type { ScreenplayStatusReport } from '../../../client/screenplay/index.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { studioScreenplayResourceKey } from '../../studio-coordination/resource-keys.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';
import { readScreenplayImport } from '../fdx/persistence/import-record.js';

export async function readScreenplayStatus(
  input: RenkuConfigPathOptions & { projectName: string },
): Promise<ScreenplayStatusReport> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    return {
      sourceOwnership: readScreenplayImport(session) ? 'fdx' : 'renku',
      counts: {
        openingElements: screenplay.opening.length,
        sections: screenplay.sections.length,
        acts: screenplay.sections.filter((section) => section.type === 'act').length,
        sequences: screenplay.sections.filter((section) => section.type === 'sequence').length,
        scenes: screenplay.scenes.length,
        blocks: screenplay.scenes.reduce((count, scene) => count + scene.blocks.length, 0),
        references: screenplay.references.length,
      },
      resourceKeys: [studioScreenplayResourceKey()],
    };
  } finally {
    session.close();
  }
}
