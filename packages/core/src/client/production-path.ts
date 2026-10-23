/** The production steps Studio tracks for a project, in path order. */
export type ProductionPathStageId =
  | 'screenplay'
  | 'screenplayAnalysis'
  | 'castAndSets'
  | 'visualLanguage'
  | 'castAndSetVisuals'
  | 'sceneBeats'
  | 'shotPlans'
  | 'videoTakes';

export type ProductionPathStageStatus = 'notStarted' | 'started' | 'complete';

export interface ProductionPathStageProgress {
  done: number;
  total: number;
}

export interface ProductionPathStage {
  id: ProductionPathStageId;
  status: ProductionPathStageStatus;
  progress: ProductionPathStageProgress | null;
}

export interface ProductionPathResource {
  /** Every stage, in path order. */
  stages: ProductionPathStage[];
  /** The first stage that is not complete; null when every stage is complete. */
  nextStageId: ProductionPathStageId | null;
}
