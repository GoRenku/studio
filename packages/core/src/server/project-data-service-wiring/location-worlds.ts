import {
  generateLocationWorld,
  readLocationWorldResource,
} from '../location-worlds/index.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createLocationWorldServiceWiring(): Pick<
  ProjectDataService,
  'generateLocationWorld' | 'readLocationWorldResource'
> {
  return { generateLocationWorld, readLocationWorldResource };
}
