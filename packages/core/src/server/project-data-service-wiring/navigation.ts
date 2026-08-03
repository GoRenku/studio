import {
  listCastNavigation,
  listLocationNavigation,
  listPropNavigation,
} from '../resources/navigation.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createNavigationServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastNavigation'
  | 'listLocationNavigation'
  | 'listPropNavigation'
> {
  return {
    listCastNavigation,
    listLocationNavigation,
    listPropNavigation,
  };
}
