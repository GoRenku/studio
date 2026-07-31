import {
  listActNavigation,
  listCastNavigation,
  listLocationNavigation,
  listPropNavigation,
  listSceneNavigation,
  listSequenceNavigation,
} from '../resources/navigation.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createNavigationServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastNavigation'
  | 'listLocationNavigation'
  | 'listPropNavigation'
  | 'listActNavigation'
  | 'listSequenceNavigation'
  | 'listSceneNavigation'
> {
  return {
    listCastNavigation,
    listLocationNavigation,
    listPropNavigation,
    listActNavigation,
    listSequenceNavigation,
    listSceneNavigation,
  };
}
