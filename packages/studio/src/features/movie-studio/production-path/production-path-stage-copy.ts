import type { ProductionPathStageId } from '@gorenku/studio-core/client';
import {
  analyzeScreenplayRequest,
  createCastLocationsAndPropsRequest,
  designAllSceneBeatsWithStoryboardsRequest,
  designLookbooksRequest,
  generateAllVideoTakesRequest,
  importScreenplayRequest,
  makeCastAndSetVisualsRequest,
  planAllShotsRequest,
} from '../agent-request-copy';

export interface ProductionPathStageCopy {
  title: string;
  description: string;
  request: string;
}

export const PRODUCTION_PATH_STAGE_COPY: Record<ProductionPathStageId, ProductionPathStageCopy> = {
  screenplay: {
    title: 'Screenplay',
    description: 'Imported from Final Draft or written with your agent.',
    request: importScreenplayRequest,
  },
  screenplayAnalysis: {
    title: 'Story analysis',
    description: 'Acts, turning points and an arc for each main character.',
    request: analyzeScreenplayRequest,
  },
  castAndSets: {
    title: 'Cast, locations and props',
    description: 'Who appears, where it happens, and what they handle.',
    request: createCastLocationsAndPropsRequest,
  },
  visualLanguage: {
    title: 'Look of the film',
    description: 'Reference images and the lookbooks your images follow.',
    request: designLookbooksRequest,
  },
  castAndSetVisuals: {
    title: 'Portraits and set images',
    description: 'How each character, place and prop looks.',
    request: makeCastAndSetVisualsRequest,
  },
  sceneBeats: {
    title: 'Beats and storyboards',
    description: 'Each scene broken into moments, with a frame for each.',
    request: designAllSceneBeatsWithStoryboardsRequest,
  },
  shotPlans: {
    title: 'Shot plans',
    description: 'Camera coverage for each scene, or a 3D previs.',
    request: planAllShotsRequest,
  },
  videoTakes: {
    title: 'Video clips',
    description: 'Generated takes for every shot plan.',
    request: generateAllVideoTakesRequest,
  },
};
