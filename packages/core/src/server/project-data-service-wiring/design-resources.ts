import { readCastDesignResource } from '../resources/cast-design.js';
import { readSceneDesignResource } from '../resources/scene-design.js';
import {
  readCastMemberResource,
  readCastOverviewResource,
  readLocationOverviewResource,
  readLocationResource,
  readSceneNarrativeResource,
  readSequenceResource,
  readStoryArcResource,
} from '../resources/screenplay-ui.js';
import {
  readActStoryboardResource,
  readSceneShotListResource,
  updateSceneShotCastCharacterSheetReference,
  updateSceneShotCastReferences,
  updateSceneShotCustomReferenceImages,
  updateSceneShotLocationSheetReference,
  updateSceneShotLocationReference,
  updateSceneShotLocationViewReferences,
  updateSceneShotLookbookReference,
  updateSceneShotReferenceInclusion,
  updateSceneShotSpecs,
} from '../resources/scene-storyboard-ui.js';
import { readStudioSelectionContext } from '../resources/selection-context.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createDesignResourceServiceWiring(): Pick<
  ProjectDataService,
  | 'readCastDesignResource'
  | 'readSceneDesignResource'
  | 'readCastOverviewResource'
  | 'readCastMemberResource'
  | 'readLocationOverviewResource'
  | 'readLocationResource'
  | 'readStoryArcResource'
  | 'readSequenceResource'
  | 'readSceneNarrativeResource'
  | 'readSceneShotListResource'
  | 'updateSceneShotCastCharacterSheetReference'
  | 'updateSceneShotCastReferences'
  | 'updateSceneShotLocationSheetReference'
  | 'updateSceneShotLocationReference'
  | 'updateSceneShotLocationViewReferences'
  | 'updateSceneShotLookbookReference'
  | 'updateSceneShotCustomReferenceImages'
  | 'updateSceneShotReferenceInclusion'
  | 'updateSceneShotSpecs'
  | 'readActStoryboardResource'
  | 'readStudioSelectionContext'
> {
  return {
    readCastDesignResource,
    readSceneDesignResource,
    readCastOverviewResource,
    readCastMemberResource,
    readLocationOverviewResource,
    readLocationResource,
    readStoryArcResource,
    readSequenceResource,
    readSceneNarrativeResource,
    readSceneShotListResource,
    updateSceneShotCastCharacterSheetReference,
    updateSceneShotCastReferences,
    updateSceneShotLocationSheetReference,
    updateSceneShotLocationReference,
    updateSceneShotLocationViewReferences,
    updateSceneShotLookbookReference,
    updateSceneShotCustomReferenceImages,
    updateSceneShotReferenceInclusion,
    updateSceneShotSpecs,
    readActStoryboardResource,
    readStudioSelectionContext,
  };
}
