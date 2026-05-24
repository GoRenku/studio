import {
  listActNavigation,
  listCastNavigation,
  listLocationNavigation,
  listSceneNavigation,
  listSequenceNavigation,
} from '../resources/navigation.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createNavigationServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastNavigation'
  | 'listLocationNavigation'
  | 'listActNavigation'
  | 'listSequenceNavigation'
  | 'listSceneNavigation'
> {
  return {
    listCastNavigation,
    listLocationNavigation,
    listActNavigation,
    listSequenceNavigation,
    listSceneNavigation,
  };
}
