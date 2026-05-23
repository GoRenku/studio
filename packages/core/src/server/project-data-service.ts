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
import {
  createInspirationFolder,
  deleteInspirationFolder,
  deleteInspirationImage,
  listInspirationFolders,
  readInspirationFolder,
  renameInspirationFolder,
  reorderInspirationFolders,
  upsertInspirationAnalysis,
  writeInspirationImage,
} from './commands/inspiration-commands.js';
import {
  deleteLookbookImage,
  importLookbookImage,
  setLookbookImageSections,
  upsertLookbook,
} from './commands/lookbook-commands.js';
import { createMovieProject } from './commands/create-movie-project.js';
import { migrateProjectDatabaseForProject } from './commands/migrate-database.js';
import { registerAsset } from './commands/register-asset.js';
import {
  patchProjectInformation,
  updateProjectInformation,
} from './commands/update-project-information.js';
import { exportProductionAssets } from './production-export/export-production-assets.js';
import { readProject } from './resources/full-project.js';
import { listLibrary, resolveCoverImage } from './resources/project-library.js';
import {
  listCastNavigation,
  listActNavigation,
  listLocationNavigation,
  listSceneNavigation,
  listSequenceNavigation,
} from './resources/navigation.js';
import { readProjectInformationResourceForProject } from './resources/project-information.js';
import { readInspirationResource } from './resources/inspiration.js';
import { readLookbookResource as readLookbook } from './resources/lookbook.js';
import { readProjectShell } from './resources/project-shell.js';
import { readSceneDesignResource } from './resources/scene-design.js';
import {
  readCastMemberResource,
  readCastOverviewResource,
  readLocationOverviewResource,
  readLocationResource,
  readSceneNarrativeResource,
  readSequenceResource,
  readStoryArcResource,
} from './resources/screenplay-ui.js';
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
    createMovieProject,
    migrateProjectDatabase: migrateProjectDatabaseForProject,
    listLibrary,
    readProject,
    readProjectShell,
    readProjectInformationResource: readProjectInformationResourceForProject,
    listCastNavigation,
    listLocationNavigation,
    listActNavigation,
    listSequenceNavigation,
    listSceneNavigation,
    listAssetPage,
    readCastDesignResource,
    readSceneDesignResource,
    readCastOverviewResource,
    readCastMemberResource,
    readLocationOverviewResource,
    readLocationResource,
    readStoryArcResource,
    readSequenceResource,
    readSceneNarrativeResource,
    readStudioSelectionContext,
    updateProjectInformation,
    patchProjectInformation,
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
    listInspirationFolders,
    readInspirationResource,
    readInspirationFolder,
    createInspirationFolder,
    renameInspirationFolder,
    reorderInspirationFolders,
    deleteInspirationFolder,
    writeInspirationImage,
    deleteInspirationImage,
    upsertInspirationAnalysis,
    readLookbook,
    upsertLookbook,
    importLookbookImage,
    deleteLookbookImage,
    setLookbookImageSections,
  };
}
