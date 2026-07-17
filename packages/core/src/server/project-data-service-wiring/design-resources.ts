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
import { readSceneBeatSheetResource } from '../resources/scene-beats.js';
import { readActStoryboardResource } from '../resources/storyboard-overviews.js';
import { readStudioSelectionContext } from '../resources/selection-context.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createDesignResourceServiceWiring(): Pick<
  ProjectDataService,
  | 'readSceneDesignResource'
  | 'readCastOverviewResource'
  | 'readCastMemberResource'
  | 'readLocationOverviewResource'
  | 'readLocationResource'
  | 'readStoryArcResource'
  | 'readSequenceResource'
  | 'readSceneNarrativeResource'
  | 'readSceneBeatSheetResource'
  | 'readActStoryboardResource'
  | 'readStudioSelectionContext'
> {
  return {
    readSceneDesignResource,
    readCastOverviewResource,
    readCastMemberResource,
    readLocationOverviewResource,
    readLocationResource,
    readStoryArcResource,
    readSequenceResource,
    readSceneNarrativeResource,
    readSceneBeatSheetResource,
    readActStoryboardResource,
    readStudioSelectionContext,
  };
}
