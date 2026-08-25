import {
  persistLocationWorldGeneration,
  prepareLocationWorldGeneration,
  readLocationWorldResource,
} from '../location-worlds/index.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createLocationWorldServiceWiring(): Pick<
  ProjectDataService,
  'persistLocationWorldGeneration' | 'prepareLocationWorldGeneration' | 'readLocationWorldResource'
> {
  return {
    persistLocationWorldGeneration,
    prepareLocationWorldGeneration,
    readLocationWorldResource,
  };
}
