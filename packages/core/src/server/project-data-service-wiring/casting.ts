import { showCastLooks, validateCastLooksPlan, writeCastLooksPlan } from '../casting/looks/commands.js';
import { readCastCastingResource } from '../casting/resource.js';
import { createCastingRound, setCastingCandidateStatus, showCastingLook } from '../casting/rounds/commands.js';
import { setCastingSettings, showCastingSettings } from '../casting/settings.js';
import { showCastWardrobe, validateCastWardrobePlan, writeCastWardrobePlan } from '../casting/wardrobe/commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createCastingServiceWiring(): Pick<
  ProjectDataService,
  | 'showCastLooks' | 'validateCastLooksPlan' | 'writeCastLooksPlan'
  | 'showCastWardrobe' | 'validateCastWardrobePlan' | 'writeCastWardrobePlan'
  | 'createCastingRound' | 'showCastingLook' | 'setCastingCandidateStatus'
  | 'showCastingSettings' | 'setCastingSettings' | 'readCastCastingResource'
> {
  return {
    showCastLooks,
    validateCastLooksPlan,
    writeCastLooksPlan,
    showCastWardrobe,
    validateCastWardrobePlan,
    writeCastWardrobePlan,
    createCastingRound,
    showCastingLook,
    setCastingCandidateStatus,
    showCastingSettings,
    setCastingSettings,
    readCastCastingResource,
  };
}
