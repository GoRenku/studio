import {
  attachCastVoice,
  createCastVoiceProviderRegistration,
  estimateKlingCastVoiceRegistration,
  listCastVoices,
  listCastVoiceProviderRegistrations,
  readCastVoiceProviderRegistration,
  readCastVoice,
  removeCastVoiceProviderRegistration,
  removeCastVoice,
  runKlingCastVoiceRegistration,
  validateCastVoiceAttachment,
} from '../commands/cast-voice-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createCastVoiceServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastVoices'
  | 'readCastVoice'
  | 'listCastVoiceProviderRegistrations'
  | 'readCastVoiceProviderRegistration'
  | 'createCastVoiceProviderRegistration'
  | 'removeCastVoiceProviderRegistration'
  | 'estimateKlingCastVoiceRegistration'
  | 'runKlingCastVoiceRegistration'
  | 'validateCastVoiceAttachment'
  | 'attachCastVoice'
  | 'removeCastVoice'
> {
  return {
    listCastVoices,
    readCastVoice,
    listCastVoiceProviderRegistrations,
    readCastVoiceProviderRegistration,
    createCastVoiceProviderRegistration,
    removeCastVoiceProviderRegistration,
    estimateKlingCastVoiceRegistration,
    runKlingCastVoiceRegistration,
    validateCastVoiceAttachment,
    attachCastVoice,
    removeCastVoice,
  };
}
