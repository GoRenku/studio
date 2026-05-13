import {
  listAssetSelects,
  listAssets,
} from './resources/assets.js';
import {
  createAssetSelect,
  removeAssetSelect,
  updateAssetSelect,
} from './commands/change-asset-selection.js';
import {
  createFromSetup,
} from './commands/create-project-from-setup.js';
import { createFromNarrativeStarter } from './commands/create-project-from-narrative-starter.js';
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
import {
  listLibrary,
  readProject,
  resolveCoverImage,
  resolveProjectAssetFile,
} from './resources/project-read-operations.js';
import {
  listAssetPage,
  listCastNavigation,
  listClipNavigation,
  listContinuityReferenceNavigation,
  listEpisodeNavigation,
  listEpisodeSequenceNavigation,
  listSceneNavigation,
  listStandaloneMovieSequenceNavigation,
  readCastDesignResource,
  readClipDesignResource,
  readStudioSelectionContext,
  readProjectInformationResourceForProject,
  readProjectShell,
} from './resources/project-resource-operations.js';
import type { ProjectDataService } from './project-data-service-contracts.js';

export type {
  ChangeAssetSelectInput,
  CreateProjectFromNarrativeStarterInput,
  CreateProjectFromSetupInput,
  ListAssetsInput,
  ListAssetPageInput,
  ListClipNavigationInput,
  ListEpisodeSequenceNavigationInput,
  ListNavigationInput,
  ListSceneNavigationInput,
  MigrateProjectDatabaseInput,
  PatchProjectInformationInput,
  ProjectDataService,
  ProjectDatabaseMigrationReport,
  ProjectInformationLanguageUpdate,
  ProjectInformationPatch,
  ProjectInformationUpdate,
  ProjectLanguagePatchOperation,
  ReadCastDesignResourceInput,
  ReadClipDesignResourceInput,
  ReadMarkdownAssetContentInput,
  ReadProjectInput,
  RemoveAssetSelectInput,
  ResolveProjectAssetFileInput,
  ResolveProjectCoverImageInput,
  ResolvedProjectAssetFile,
  UpdateMarkdownAssetContentInput,
  UpdateMarkdownAssetContentResult,
  UpdateProjectInformationInput,
} from './project-data-service-contracts.js';

export function createProjectDataService(): ProjectDataService {
  return {
    createFromSetup,
    createFromNarrativeStarter,
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
  };
}
