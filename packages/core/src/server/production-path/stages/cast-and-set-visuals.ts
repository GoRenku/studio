import { readCastReadiness } from '../../production-readiness/cast.js';
import { readProductionDesignReadiness } from '../../production-readiness/production-design.js';
import { statusFromProgress, type ProductionPathStageReader } from '../stage-status.js';

/**
 * Counts on-screen Cast Members, Locations and Props that have their reference media.
 * Complete only when all of them do and there is at least one on-screen Cast Member.
 */
export const readCastAndSetVisualsStage: ProductionPathStageReader = (session) => {
  const cast = readCastReadiness(session);
  const design = readProductionDesignReadiness(session);
  const total = cast.castMemberCount + design.locationCount + design.propCount;
  const missing =
    cast.missingVisualReferenceCastMemberIds.length +
    design.missingEnvironmentSheetLocationIds.length +
    design.missingPropSheetPropIds.length;
  const progress = { done: total - missing, total };
  const status = statusFromProgress(progress);
  return {
    id: 'castAndSetVisuals',
    status: status === 'complete' && cast.castMemberCount === 0 ? 'started' : status,
    progress,
  };
};
