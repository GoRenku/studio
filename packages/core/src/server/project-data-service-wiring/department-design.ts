import {
  applyCastOperations,
  listCastMembers,
  readCastContext,
  readCastMember,
  validateCastOperations,
} from '../commands/cast-commands.js';
import {
  listCastDesigns,
  readCastDesign,
  setActiveCastDesign,
  validateCastDesign,
  writeCastDesign,
} from '../commands/cast-design-commands.js';
import {
  applyLocationOperations,
  listLocations,
  readLocation,
  readLocationContext,
  validateLocationOperations,
} from '../commands/location-commands.js';
import {
  listLocationDesigns,
  readLocationDesign,
  setActiveLocationDesign,
  validateLocationDesign,
  writeLocationDesign,
} from '../commands/production-design-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createDepartmentDesignServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastMembers' | 'readCastMember' | 'readCastContext'
  | 'validateCastOperations' | 'applyCastOperations'
  | 'listCastDesigns' | 'readCastDesign' | 'validateCastDesign'
  | 'writeCastDesign' | 'setActiveCastDesign'
  | 'listLocations' | 'readLocation' | 'readLocationContext'
  | 'validateLocationOperations' | 'applyLocationOperations'
  | 'listLocationDesigns' | 'readLocationDesign' | 'validateLocationDesign'
  | 'writeLocationDesign' | 'setActiveLocationDesign'
> {
  return {
    listCastMembers,
    readCastMember,
    readCastContext,
    validateCastOperations,
    applyCastOperations,
    listCastDesigns,
    readCastDesign,
    validateCastDesign,
    writeCastDesign,
    setActiveCastDesign,
    listLocations,
    readLocation,
    readLocationContext,
    validateLocationOperations,
    applyLocationOperations,
    listLocationDesigns,
    readLocationDesign,
    validateLocationDesign,
    writeLocationDesign,
    setActiveLocationDesign,
  };
}
