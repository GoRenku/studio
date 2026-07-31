import {
  applyCastOperations,
  listCastMembers,
  readCastContext,
  readCastMember,
  updateCastMemberVoiceOverStatus,
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
} from '../commands/location-design-commands.js';
import {
  applyPropOperations,
  listProps,
  readProp,
  readPropContext,
  validatePropOperations,
} from '../commands/prop-commands.js';
import {
  listPropDesigns,
  readPropDesign,
  setActivePropDesign,
  validatePropDesign,
  writePropDesign,
} from '../commands/prop-design-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createDepartmentDesignServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastMembers' | 'readCastMember' | 'readCastContext'
  | 'updateCastMemberVoiceOverStatus'
  | 'validateCastOperations' | 'applyCastOperations'
  | 'listCastDesigns' | 'readCastDesign' | 'validateCastDesign'
  | 'writeCastDesign' | 'setActiveCastDesign'
  | 'listLocations' | 'readLocation' | 'readLocationContext'
  | 'validateLocationOperations' | 'applyLocationOperations'
  | 'listLocationDesigns' | 'readLocationDesign' | 'validateLocationDesign'
  | 'writeLocationDesign' | 'setActiveLocationDesign'
    | 'listProps' | 'readProp' | 'readPropContext'
    | 'validatePropOperations' | 'applyPropOperations'
    | 'listPropDesigns' | 'readPropDesign' | 'validatePropDesign'
    | 'writePropDesign' | 'setActivePropDesign'
> {
  return {
    listCastMembers,
    readCastMember,
    readCastContext,
    updateCastMemberVoiceOverStatus,
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
    listProps,
    readProp,
    readPropContext,
    validatePropOperations,
    applyPropOperations,
    listPropDesigns,
    readPropDesign,
    validatePropDesign,
    writePropDesign,
    setActivePropDesign,
  };
}
