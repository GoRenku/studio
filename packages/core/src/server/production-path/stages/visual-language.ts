import { readVisualLanguageReadiness } from '../../production-readiness/visual-language.js';
import type { ProductionPathStageReader } from '../stage-status.js';

/** Complete once both the Production and Storyboard Lookbooks exist. */
export const readVisualLanguageStage: ProductionPathStageReader = (session) => {
  const readiness = readVisualLanguageReadiness(session);
  if (readiness.productionLookbookId && readiness.storyboardLookbookId) {
    return { id: 'visualLanguage', status: 'complete', progress: null };
  }
  const anyAuthored = readiness.inspirationFolderCount > 0 || readiness.lookbookCount > 0;
  return { id: 'visualLanguage', status: anyAuthored ? 'started' : 'notStarted', progress: null };
};
