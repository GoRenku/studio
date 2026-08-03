import {
  applyScreenplayOperations,
  createScreenplay,
  listSceneProductionNumbers,
  listScreenplayRevisions,
  readScreenplayRevision,
  readScreenplayScene,
  readScreenplaySection,
  readScreenplayStatus,
  readScreenplayStructure,
  resolveSceneProductionNumber,
  restoreScreenplayRevision,
} from '../screenplay/index.js';
import { listScreenplayAnalyses, readScreenplayAnalysis, readScreenplayAnalysisContext, setActiveScreenplayAnalysis, validateScreenplayAnalysis, writeScreenplayAnalysis } from '../screenplay-analysis/index.js';
import {
  listSceneBeatSheets,
  readSceneBeatSheet,
  setActiveSceneBeatSheet,
  validateSceneBeatSheet,
  writeSceneBeatSheet,
} from '../scene-beat-sheet/history.js';
import { readSceneBeatSheetContext } from '../screenplay/context/beat-sheet.js';
import {
  applySceneBeatSheetOperations,
  validateSceneBeatSheetOperations,
} from '../scene-beat-sheet/operations.js';
import { readSceneBeatSheetStoryboardStatus } from '../scene-beat-sheet/storyboard-status.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createScreenplayServiceWiring(): Pick<
  ProjectDataService,
  | 'readScreenplayStatus' | 'readScreenplayStructure'
  | 'readScreenplaySection' | 'readScreenplayScene'
  | 'listSceneProductionNumbers' | 'resolveSceneProductionNumber'
  | 'createScreenplay' | 'applyScreenplayOperations'
  | 'listScreenplayRevisions' | 'readScreenplayRevision'
  | 'restoreScreenplayRevision'
  | 'readScreenplayAnalysisContext' | 'listScreenplayAnalyses'
  | 'readScreenplayAnalysis' | 'validateScreenplayAnalysis'
  | 'writeScreenplayAnalysis' | 'setActiveScreenplayAnalysis'
  | 'readSceneBeatSheetContext' | 'listSceneBeatSheets' | 'readSceneBeatSheet'
  | 'validateSceneBeatSheet' | 'writeSceneBeatSheet' | 'setActiveSceneBeatSheet'
  | 'validateSceneBeatSheetOperations' | 'applySceneBeatSheetOperations'
  | 'readSceneBeatSheetStoryboardStatus'
> {
  return {
    readScreenplayStatus, readScreenplayStructure,
    readScreenplaySection, readScreenplayScene,
    listSceneProductionNumbers, resolveSceneProductionNumber,
    createScreenplay, applyScreenplayOperations,
    listScreenplayRevisions, readScreenplayRevision, restoreScreenplayRevision,
    readScreenplayAnalysisContext, listScreenplayAnalyses,
    readScreenplayAnalysis, validateScreenplayAnalysis,
    writeScreenplayAnalysis, setActiveScreenplayAnalysis,
    readSceneBeatSheetContext, listSceneBeatSheets, readSceneBeatSheet,
    validateSceneBeatSheet, writeSceneBeatSheet, setActiveSceneBeatSheet,
    validateSceneBeatSheetOperations, applySceneBeatSheetOperations,
    readSceneBeatSheetStoryboardStatus,
  };
}
