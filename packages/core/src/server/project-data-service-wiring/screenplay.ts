import { applyScreenplayOperations } from '../commands/apply-screenplay-operations.js';
import { createScreenplay } from '../commands/create-screenplay.js';
import {
  listScreenplayAnalyses,
  readScreenplayAnalysis,
  readScreenplayAnalysisContext,
  setActiveScreenplayAnalysis,
  validateScreenplayAnalysis,
  writeScreenplayAnalysis,
} from '../commands/screenplay-analysis-commands.js';
import { validateScreenplayJson } from '../commands/validate-screenplay-json.js';
import {
  listScreenplayActs,
  listScreenplayCastMembers,
  listScreenplayLocations,
  listScreenplayScenesForSequence,
  listScreenplaySequencesForAct,
  readScreenplay,
  readScreenplayAct,
  readScreenplayCastMember,
  readScreenplayLocation,
  readScreenplayScene,
  readScreenplaySequence,
} from '../resources/screenplay.js';
import { readScreenplayStatus } from '../resources/screenplay-status.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createScreenplayServiceWiring(): Pick<
  ProjectDataService,
  | 'readScreenplayStatus'
  | 'readScreenplay'
  | 'listScreenplayCastMembers'
  | 'readScreenplayCastMember'
  | 'listScreenplayLocations'
  | 'readScreenplayLocation'
  | 'listScreenplayActs'
  | 'readScreenplayAct'
  | 'listScreenplaySequencesForAct'
  | 'readScreenplaySequence'
  | 'listScreenplayScenesForSequence'
  | 'readScreenplayScene'
  | 'validateScreenplayJson'
  | 'createScreenplay'
  | 'applyScreenplayOperations'
  | 'readScreenplayAnalysisContext'
  | 'listScreenplayAnalyses'
  | 'readScreenplayAnalysis'
  | 'validateScreenplayAnalysis'
  | 'writeScreenplayAnalysis'
  | 'setActiveScreenplayAnalysis'
> {
  return {
    readScreenplayStatus,
    readScreenplay,
    listScreenplayCastMembers,
    readScreenplayCastMember,
    listScreenplayLocations,
    readScreenplayLocation,
    listScreenplayActs,
    readScreenplayAct,
    listScreenplaySequencesForAct,
    readScreenplaySequence,
    listScreenplayScenesForSequence,
    readScreenplayScene,
    validateScreenplayJson,
    createScreenplay,
    applyScreenplayOperations,
    readScreenplayAnalysisContext,
    listScreenplayAnalyses,
    readScreenplayAnalysis,
    validateScreenplayAnalysis,
    writeScreenplayAnalysis,
    setActiveScreenplayAnalysis,
  };
}
