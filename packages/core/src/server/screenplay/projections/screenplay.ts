import type { Screenplay } from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { readScreenplayAggregate } from '../persistence/screenplay.js';
import { projectCanonicalScreenplayStructure } from './structure.js';

export function readCanonicalScreenplay(session: DatabaseSession): Screenplay {
  const screenplay = readScreenplayAggregate(session);
  const canonical = projectCanonicalScreenplayStructure(screenplay);
  return {
    ...screenplay,
    scenes: canonical.scenes,
    sections: canonical.sections,
    structure: canonical.structure,
  };
}
