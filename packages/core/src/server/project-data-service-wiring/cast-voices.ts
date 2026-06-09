import {
  attachCastVoice,
  listCastVoices,
  readCastVoice,
  removeCastVoice,
  validateCastVoiceAttachment,
} from '../commands/cast-voice-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createCastVoiceServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastVoices'
  | 'readCastVoice'
  | 'validateCastVoiceAttachment'
  | 'attachCastVoice'
  | 'removeCastVoice'
> {
  return {
    listCastVoices,
    readCastVoice,
    validateCastVoiceAttachment,
    attachCastVoice,
    removeCastVoice,
  };
}
