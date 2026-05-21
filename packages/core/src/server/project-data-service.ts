import {
  listAssetPage,
  listAssetSelects,
  listAssets,
  resolveProjectAssetFile,
} from './resources/assets.js';
import { readCastDesignResource } from './resources/cast-design.js';
import {
  createAssetSelect,
  removeAssetSelect,
  updateAssetSelect,
} from './commands/change-asset-selection.js';
import { applyScreenplayOperations } from './commands/apply-screenplay-operations.js';
import { createScreenplay } from './commands/create-screenplay.js';
import { readClipDesignResource } from './resources/clip-design.js';
import {
  createFromSetup,
} from './commands/create-project-from-setup.js';
import { migrateProjectDatabaseForProject } from './commands/migrate-database.js';
import { registerAsset } from './commands/register-asset.js';
import {
  updateMarkdownAssetContent,
} from './commands/update-markdown-asset-content.js';
import { readMarkdownAssetContent } from './resources/markdown-asset-content.js';
import {
  patchProjectInformation,
  updateProjectInformation,
} from './commands/update-project-information.js';
import { exportProductionAssets } from './production-export/export-production-assets.js';
import { readProject } from './resources/full-project.js';
import { listLibrary, resolveCoverImage } from './resources/project-library.js';
import {
  listCastNavigation,
  listClipNavigation,
  listContinuityReferenceNavigation,
  listEpisodeNavigation,
  listEpisodeSequenceNavigation,
  listSceneNavigation,
  listStandaloneMovieSequenceNavigation,
} from './resources/navigation.js';
import { readProjectInformationResourceForProject } from './resources/project-information.js';
import { readProjectShell } from './resources/project-shell.js';
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
} from './resources/screenplay.js';
import { readScreenplayStatus } from './resources/screenplay-status.js';
import { readStudioSelectionContext } from './resources/selection-context.js';
import type { ProjectDataService } from './project-data-service-contracts.js';
import {
  closeCurrentProject,
  openCurrentProject,
  readCurrentProject,
} from './database/lifecycle/current-project.js';
import { validateScreenplayJson } from './commands/validate-screenplay-json.js';

export function createProjectDataService(): ProjectDataService {
  return {
    createFromSetup,
    migrateProjectDatabase: migrateProjectDatabaseForProject,
    listLibrary,
    readProject,
    readProjectShell,
    readProjectInformationResource: readProjectInformationResourceForProject,
    listCastNavigation,
    listContinuityReferenceNavigation,
    listEpisodeNavigation,
    listStandaloneMovieSequenceNavigation,
    listEpisodeSequenceNavigation,
    listSceneNavigation,
    listClipNavigation,
    listAssetPage,
    readCastDesignResource,
    readClipDesignResource,
    readStudioSelectionContext,
    updateProjectInformation,
    patchProjectInformation,
    readMarkdownAssetContent,
    updateMarkdownAssetContent,
    resolveCoverImage,
    resolveProjectAssetFile,
    registerAsset,
    listAssets,
    createAssetSelect,
    updateAssetSelect,
    removeAssetSelect,
    listAssetSelects,
    exportProductionAssets,
    openCurrentProject,
    readCurrentProject,
    closeCurrentProject,
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
  };
}
