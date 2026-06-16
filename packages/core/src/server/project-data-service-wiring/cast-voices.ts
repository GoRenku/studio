import {
  attachCastVoice,
  createCastVoiceProviderRegistration,
  listCastVoices,
  listCastVoiceProviderRegistrations,
  readCastVoiceProviderRegistration,
  readCastVoice,
  removeCastVoiceProviderRegistration,
  removeCastVoice,
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
    validateCastVoiceAttachment,
    attachCastVoice,
    removeCastVoice,
  };
}
