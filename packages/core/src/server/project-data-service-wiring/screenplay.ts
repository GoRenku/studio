import { applyScreenplayOperations } from '../commands/apply-screenplay-operations.js';
import { createScreenplay } from '../commands/create-screenplay.js';
import { reviseScreenplayScene } from '../commands/revise-screenplay-scene.js';
import {
  listScreenplayRevisions,
  readScreenplayRevision,
  restoreScreenplayRevision,
} from '../commands/screenplay-revision-commands.js';
import { listScreenplayAnalyses, readScreenplayAnalysis, readScreenplayAnalysisContext, setActiveScreenplayAnalysis, validateScreenplayAnalysis, writeScreenplayAnalysis } from '../commands/screenplay-analysis-commands.js';
import {
  listSceneBeatSheets,
  readSceneBeatSheet,
  setActiveSceneBeatSheet,
  validateSceneBeatSheet,
  writeSceneBeatSheet,
} from '../scene-beat-sheet/history.js';
import { readSceneBeatSheetContext } from '../scene-beat-sheet/context.js';
import {
  applySceneBeatSheetOperations,
  validateSceneBeatSheetOperations,
} from '../scene-beat-sheet/operations.js';
import { readSceneBeatSheetStoryboardStatus } from '../scene-beat-sheet/storyboard-status.js';
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
  | 'readScreenplayStatus' | 'readScreenplay'
  | 'listScreenplayCastMembers' | 'readScreenplayCastMember'
  | 'listScreenplayLocations' | 'readScreenplayLocation'
  | 'listScreenplayActs' | 'readScreenplayAct'
  | 'listScreenplaySequencesForAct' | 'readScreenplaySequence'
  | 'listScreenplayScenesForSequence' | 'readScreenplayScene'
  | 'validateScreenplayJson' | 'createScreenplay' | 'applyScreenplayOperations'
  | 'reviseScreenplayScene' | 'listScreenplayRevisions'
  | 'readScreenplayRevision' | 'restoreScreenplayRevision'
  | 'readScreenplayAnalysisContext' | 'listScreenplayAnalyses'
  | 'readScreenplayAnalysis' | 'validateScreenplayAnalysis'
  | 'writeScreenplayAnalysis' | 'setActiveScreenplayAnalysis'
  | 'readSceneBeatSheetContext' | 'listSceneBeatSheets' | 'readSceneBeatSheet'
  | 'validateSceneBeatSheet' | 'writeSceneBeatSheet' | 'setActiveSceneBeatSheet'
  | 'validateSceneBeatSheetOperations' | 'applySceneBeatSheetOperations'
  | 'readSceneBeatSheetStoryboardStatus'
> {
  return {
    readScreenplayStatus, readScreenplay,
    listScreenplayCastMembers, readScreenplayCastMember,
    listScreenplayLocations, readScreenplayLocation,
    listScreenplayActs, readScreenplayAct,
    listScreenplaySequencesForAct, readScreenplaySequence,
    listScreenplayScenesForSequence, readScreenplayScene,
    validateScreenplayJson, createScreenplay, applyScreenplayOperations,
    reviseScreenplayScene, listScreenplayRevisions,
    readScreenplayRevision, restoreScreenplayRevision,
    readScreenplayAnalysisContext, listScreenplayAnalyses,
    readScreenplayAnalysis, validateScreenplayAnalysis,
    writeScreenplayAnalysis, setActiveScreenplayAnalysis,
    readSceneBeatSheetContext, listSceneBeatSheets, readSceneBeatSheet,
    validateSceneBeatSheet, writeSceneBeatSheet, setActiveSceneBeatSheet,
    validateSceneBeatSheetOperations, applySceneBeatSheetOperations,
    readSceneBeatSheetStoryboardStatus,
  };
}
