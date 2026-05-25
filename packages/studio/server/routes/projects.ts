import fs from 'node:fs/promises';
import {
  createProjectDataService,
  type Asset,
  type AssetFile,
  type AssetTarget,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  toProjectLibraryResponse,
  toProjectShellResponse,
} from '../http/project-responses.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';
import { createAssetsRoute } from './assets.js';
import { createMovieStudioSelectionContextRoute } from './movie-studio-selection-context.js';
import { createNavigationRoute } from './navigation.js';
import { createProductionExportsRoute } from './production-exports.js';
import { createProjectInformationRoute } from './project-information.js';
import { createScreenplayRoute } from './screenplay.js';
import { createVisualLanguageRoute } from './visual-language.js';

export interface CreateProjectsRouteOptions {
  projectData?: ProjectsRouteProjectData;
  token?: StudioRuntimeToken;
}

export type ProjectsRouteProjectData = Pick<
  ProjectDataService,
  | 'listLibrary'
  | 'readProject'
  | 'readProjectShell'
  | 'readProjectInformationResource'
  | 'listCastNavigation'
  | 'listLocationNavigation'
  | 'listActNavigation'
  | 'listSequenceNavigation'
  | 'listSceneNavigation'
  | 'listAssetPage'
  | 'readCastDesignResource'
  | 'readSceneDesignResource'
  | 'readCastOverviewResource'
  | 'readCastMemberResource'
  | 'readLocationOverviewResource'
  | 'readLocationResource'
  | 'readStoryArcResource'
  | 'readSequenceResource'
  | 'readSceneNarrativeResource'
  | 'readStudioSelectionContext'
  | 'updateProjectInformation'
  | 'resolveCoverImage'
  | 'listAssets'
  | 'createAssetSelect'
  | 'removeAssetSelect'
  | 'exportProductionAssets'
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
  | 'listLookbooks'
  | 'readLookbook'
  | 'validateLookbook'
  | 'createLookbook'
  | 'updateLookbook'
  | 'renameLookbook'
  | 'deleteLookbook'
  | 'setActiveLookbook'
  | 'clearActiveLookbook'
  | 'setLookbookSourceInspirations'
  | 'listLookbookSourceInspirations'
  | 'setLookbookCardImage'
  | 'clearLookbookCardImage'
  | 'buildLookbookImageContext'
  | 'listLookbookImageModels'
  | 'validateLookbookImageSpec'
  | 'createLookbookImageSpec'
  | 'updateLookbookImageSpec'
  | 'readLookbookImageSpec'
  | 'listLookbookImageSpecs'
  | 'prepareLookbookImageSpec'
  | 'estimateLookbookImageSpec'
  | 'runLookbookImageSpec'
  | 'recordLookbookImageRun'
  | 'importLookbookImageMedia'
  | 'deleteLookbookImage'
  | 'setLookbookImageSections'
> & {
  resolveProjectAssetFile(input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    assetFileId: string;
  }): Promise<{
    asset: Asset;
    file: AssetFile;
    absolutePath: string;
  }>;
};

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
    .get('/:projectName', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const project = await projectData.readProjectShell({ projectName });
        return c.json({
          project: toProjectShellResponse(project),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .route('/:projectName', createNavigationRoute({ projectData }))
    .route('/:projectName', createScreenplayRoute({ projectData }))
    .route('/:projectName', createVisualLanguageRoute({ projectData }))
    .route('/:projectName', createAssetsRoute({ projectData, requireToken }))
    .route(
      '/:projectName',
      createProjectInformationRoute({ projectData, requireToken })
    )
    .route(
      '/:projectName',
      createProductionExportsRoute({ projectData, requireToken })
    )
    .route(
      '/:projectName',
      createMovieStudioSelectionContextRoute({ projectData })
    )
    .get('/:projectName/cover', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const coverPath = await projectData.resolveCoverImage({ projectName });
        if (!coverPath) {
          return c.json(
            {
              error: {
                code: 'STUDIO_SERVER004',
                message: 'Project cover image not found.',
              },
            },
            404
          );
        }
        const bytes = await fs.readFile(coverPath);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

const projects = createProjectsRoute();

export default projects;
export type ProjectsRoute = typeof projects;
