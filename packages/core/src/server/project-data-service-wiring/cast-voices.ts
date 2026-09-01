import {
  attachCastVoice,
  listCastVoices,
  readCastVoice,
  removeCastVoice,
  selectDefaultCastVoice,
  validateCastVoiceAttachment,
} from '../cast-voices/index.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createCastVoiceServiceWiring(): Pick<
  ProjectDataService,
  | 'listCastVoices'
  | 'readCastVoice'
  | 'validateCastVoiceAttachment'
  | 'attachCastVoice'
  | 'selectDefaultCastVoice'
  | 'removeCastVoice'
> {
  return {
    listCastVoices,
    readCastVoice,
    validateCastVoiceAttachment,
    attachCastVoice,
    selectDefaultCastVoice,
    removeCastVoice,
  };
}
