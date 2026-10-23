import type { ProductionPathStageReader } from './stage-status.js';
import { readCastAndSetVisualsStage } from './stages/cast-and-set-visuals.js';
import { readCastAndSetsStage } from './stages/cast-and-sets.js';
import { readSceneBeatsStage } from './stages/scene-beats.js';
import { readScreenplayAnalysisStage } from './stages/screenplay-analysis.js';
import { readScreenplayStage } from './stages/screenplay.js';
import { readShotPlansStage } from './stages/shot-plans.js';
import { readVideoTakesStage } from './stages/video-takes.js';
import { readVisualLanguageStage } from './stages/visual-language.js';

/** The production path, in the order a film is usually made. */
export const productionPathStageReaders: readonly ProductionPathStageReader[] = [
  readScreenplayStage,
  readScreenplayAnalysisStage,
  readCastAndSetsStage,
  readVisualLanguageStage,
  readCastAndSetVisualsStage,
  readSceneBeatsStage,
  readShotPlansStage,
  readVideoTakesStage,
];
