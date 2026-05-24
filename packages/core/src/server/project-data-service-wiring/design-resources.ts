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
    readStudioSelectionContext,
  };
}
