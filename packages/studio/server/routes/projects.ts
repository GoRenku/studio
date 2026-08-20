import {
  createProjectDataService,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  toProjectLibraryResponse,
  toProjectShellResponse,
} from '../http/project-responses.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import { readProjectCreateRequest } from '../http/project-create-request.js';
import { readProjectDeleteRequest } from '../http/project-delete-request.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';
import { createAssetsRoute } from './assets.js';
import { createContinuityRoute } from './continuity.js';
import { createGenerationPreviewRoute } from './generation-preview.js';
import { createGenerationReferencesRoute } from './generation-references.js';
import { createGenerationRequestsRoute } from './generation-requests.js';
import { createMovieStudioSelectionContextRoute } from './movie-studio-selection-context.js';
import { createNavigationRoute } from './navigation.js';
import { createProjectInformationRoute } from './project-information.js';
import { createProjectSettingsRoute } from './project-settings.js';
import { createScreenplayRoute } from './screenplay/index.js';
import { createShotPlansRoute } from './shot-plans.js';
import { createTrashRoute } from './trash.js';
import { createVisualLanguageRoute } from './visual-language.js';
import { createShotPlanVideoGenerationsRoute } from './shot-plan-video-generations.js';

export interface CreateProjectsRouteOptions {
  projectData?: ProjectsRouteProjectData;
  token?: StudioRuntimeToken;
}

export type ProjectsRouteProjectData = Pick<
  ProjectDataService,
  | 'createMovieProject'
  | 'deleteProject'
  | 'listLibrary'
  | 'readProject'
  | 'readProjectShell'
  | 'readProjectInformationResource'
  | 'readProjectSettings'
  | 'replaceProjectSettings'
  | 'listCastNavigation'
  | 'listLocationNavigation'
  | 'listAssetPage'
  | 'readSceneDesignResource'
  | 'readCastOverviewResource'
  | 'readCastMemberResource'
  | 'updateCastMemberVoiceOverStatus'
  | 'readLocationOverviewResource'
  | 'readLocationResource'
  | 'readPropOverviewResource'
  | 'readPropResource'
  | 'readStoryArcResource'
  | 'readScreenplayStructure'
  | 'readScreenplaySection'
  | 'readScreenplayScene'
  | 'readSceneDialogueAudioWorkspace'
  | 'estimateSceneDialogueAudioDraft'
  | 'updateSceneDialogueAudioSetup'
  | 'generateSceneDialogueAudioTake'
  | 'deleteSceneDialogueAudioTake'
  | 'readSceneBeatsResource'
  | 'readScreenplayBeatGalleryResource'
  | 'listGenerationReferences'
  | 'readStudioSelectionContext'
  | 'listSceneShotPlans'
  | 'readShotPlan'
  | 'deleteShotPlan'
  | 'patchProjectInformation'
  | 'listAssets'
  | 'resolveProjectAssetFileById'
  | 'selectAsset'
  | 'clearAssetSelection'
  | 'discardAsset'
  | 'listTrash'
  | 'restoreTrashItem'
  | 'previewGarbageCollection'
  | 'emptyTrash'
  | 'listSceneShotPlanVideoGenerations'
  | 'listCastVoices'
  | 'readCastVoice'
  | 'removeCastVoice'
  | 'readInspirationResource'
  | 'readInspirationFolder'
  | 'createInspirationFolder'
  | 'renameInspirationFolder'
  | 'reorderInspirationFolders'
  | 'deleteInspirationFolder'
  | 'writeInspirationImage'
  | 'deleteInspirationImage'
  | 'readInspirationAnalysis'
  | 'validateInspirationAnalysis'
  | 'writeInspirationAnalysis'
  | 'readProjectLookbooks'
  | 'readProductionLookbook'
  | 'readStoryboardLookbook'
  | 'validateProductionLookbook'
  | 'validateStoryboardLookbook'
  | 'writeProductionLookbook'
  | 'writeStoryboardLookbook'
  | 'setLookbookSourceInspirations'
  | 'listLookbookSourceInspirations'
  | 'attachGenerationMedia'
  | 'deleteLookbookImage'
  | 'deleteLookbookSheet'
  | 'setLookbookImagePlacement'
>;

export function createProjectsRoute(
  options: CreateProjectsRouteOptions = {}
) {
  const projectData =
    options.projectData ??
    (createProjectDataService() as unknown as ProjectsRouteProjectData);
  const requireToken: MiddlewareHandler = options.token
    ? createStudioApiTokenMiddleware(options.token)
    : async (_c, next) => {
        await next();
      };

  return new Hono()
    .get('/', async (c) => {
      try {
        const library = await projectData.listLibrary();
        return c.json({ library: toProjectLibraryResponse(library) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/', requireToken, async (c) => {
      try {
        const request = readProjectCreateRequest(
          await c.req.json().catch(() => undefined)
        );
        const report = await projectData.createMovieProject(request);
        return c.json({ report }, 201);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/:projectName', requireToken, async (c) => {
      try {
        const request = readProjectDeleteRequest(
          await c.req.json().catch(() => undefined)
        );
        const report = await projectData.deleteProject({
          projectName: c.req.param('projectName'),
          confirmationProjectName: request.confirmationProjectName,
        });
        return c.json({ report });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const [project, library] = await Promise.all([
          projectData.readProjectShell({ projectName }),
          projectData.listLibrary(),
        ]);
        return c.json({
          project: toProjectShellResponse(project, library.storageRoot),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .route('/:projectName', createNavigationRoute({ projectData }))
    .route('/:projectName', createContinuityRoute({ projectData, requireToken }))
    .route('/:projectName', createScreenplayRoute({ projectData, requireToken }))
    .route('/:projectName', createShotPlansRoute({ projectData, requireToken }))
    .route(
      '/:projectName',
      createShotPlanVideoGenerationsRoute({ projectData, requireToken }),
    )
    .route('/:projectName', createVisualLanguageRoute({ projectData }))
    .route('/:projectName', createAssetsRoute({ projectData, requireToken }))
    .route(
      '/:projectName',
      createGenerationPreviewRoute({ requireToken })
    )
    .route(
      '/:projectName',
      createGenerationReferencesRoute({ projectData, requireToken })
    )
    .route('/:projectName', createGenerationRequestsRoute({ requireToken }))
    .route('/:projectName', createTrashRoute({ projectData, requireToken }))
    .route(
      '/:projectName',
      createProjectInformationRoute({ projectData, requireToken })
    )
    .route(
      '/:projectName',
      createProjectSettingsRoute({ projectData, requireToken })
    )
    .route(
      '/:projectName',
      createMovieStudioSelectionContextRoute({ projectData })
    );
}

const projects = createProjectsRoute();

export default projects;
export type ProjectsRoute = typeof projects;
