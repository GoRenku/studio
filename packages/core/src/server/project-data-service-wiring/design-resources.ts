import { readSceneDesignResource } from '../resources/scene-design.js';
import {
  readCastMemberResource,
  readCastOverviewResource,
  readLocationOverviewResource,
  readLocationResource,
  readPropOverviewResource,
  readPropResource,
} from '../resources/continuity-subjects.js';
import {
  readSceneNarrativeResource,
} from '../resources/screenplay-ui.js';
import { readStoryArcResource } from '../screenplay-analysis/story-arc-resource.js';
import { readSceneBeatsResource } from '../resources/scene-beats.js';
import { readStudioSelectionContext } from '../resources/selection-context.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createDesignResourceServiceWiring(): Pick<
  ProjectDataService,
  | 'readSceneDesignResource'
  | 'readCastOverviewResource'
  | 'readCastMemberResource'
  | 'readLocationOverviewResource'
  | 'readLocationResource'
  | 'readPropOverviewResource'
  | 'readPropResource'
  | 'readStoryArcResource'
  | 'readSceneNarrativeResource'
  | 'readSceneBeatsResource'
  | 'readStudioSelectionContext'
> {
  return {
    readSceneDesignResource,
    readCastOverviewResource,
    readCastMemberResource,
    readLocationOverviewResource,
    readLocationResource,
    readPropOverviewResource,
    readPropResource,
    readStoryArcResource,
    readSceneNarrativeResource,
    readSceneBeatsResource,
    readStudioSelectionContext,
  };
}
