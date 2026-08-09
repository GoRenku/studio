import {
  applyScreenplayOperations,
  createScreenplay,
  importFdxScreenplay,
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
  listSceneBeatsRevisions,
  readSceneBeatsRevision,
  resetSceneBeats,
  setActiveSceneBeatsRevision,
  validateSceneBeats,
  createSceneBeatsRevision,
} from '../scene-beats/history.js';
import { readSceneBeatsContext } from '../screenplay/context/scene-beats.js';
import {
  applySceneBeatsOperations,
  validateSceneBeatsOperations,
} from '../scene-beats/operations.js';
import { readSceneStoryboardStatus } from '../scene-beats/storyboard-status.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createScreenplayServiceWiring(): Pick<
  ProjectDataService,
  | 'readScreenplayStatus' | 'readScreenplayStructure'
  | 'readScreenplaySection' | 'readScreenplayScene'
  | 'listSceneProductionNumbers' | 'resolveSceneProductionNumber'
  | 'createScreenplay' | 'importFdxScreenplay' | 'applyScreenplayOperations'
  | 'listScreenplayRevisions' | 'readScreenplayRevision'
  | 'restoreScreenplayRevision'
  | 'readScreenplayAnalysisContext' | 'listScreenplayAnalyses'
  | 'readScreenplayAnalysis' | 'validateScreenplayAnalysis'
  | 'writeScreenplayAnalysis' | 'setActiveScreenplayAnalysis'
  | 'readSceneBeatsContext' | 'listSceneBeatsRevisions' | 'readSceneBeatsRevision'
  | 'validateSceneBeats' | 'createSceneBeatsRevision' | 'resetSceneBeats'
  | 'setActiveSceneBeatsRevision'
  | 'validateSceneBeatsOperations' | 'applySceneBeatsOperations'
  | 'readSceneStoryboardStatus'
> {
  return {
    readScreenplayStatus, readScreenplayStructure,
    readScreenplaySection, readScreenplayScene,
    listSceneProductionNumbers, resolveSceneProductionNumber,
    createScreenplay, importFdxScreenplay, applyScreenplayOperations,
    listScreenplayRevisions, readScreenplayRevision, restoreScreenplayRevision,
    readScreenplayAnalysisContext, listScreenplayAnalyses,
    readScreenplayAnalysis, validateScreenplayAnalysis,
    writeScreenplayAnalysis, setActiveScreenplayAnalysis,
    readSceneBeatsContext, listSceneBeatsRevisions, readSceneBeatsRevision,
    validateSceneBeats, createSceneBeatsRevision, resetSceneBeats,
    setActiveSceneBeatsRevision,
    validateSceneBeatsOperations, applySceneBeatsOperations,
    readSceneStoryboardStatus,
  };
}
