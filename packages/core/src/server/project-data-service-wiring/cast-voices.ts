import {
  attachCastVoice,
  listCastVoices,
  readCastVoice,
  removeCastVoice,
  selectDefaultCastVoice,
  validateCastVoiceAttachment,
} from '../cast-voices/index.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';
import { recordGenerationCompleted } from '../telemetry/service.js';

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
    async attachCastVoice(input) {
      const report = await attachCastVoice(input);
      recordGenerationCompleted([report.voice.sample], input);
      return report;
    },
    selectDefaultCastVoice,
    removeCastVoice,
  };
}
