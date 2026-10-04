import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readAssetFilePageRequest } from '../http/asset-request.js';
import {
  readProjectAssetFileByIdResponse,
} from '../http/asset-file-response.js';
import { toStudioAssetFileResponse } from '../http/asset-responses.js';
import { readPageRequest } from '../http/pagination-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateAssetFilesRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createAssetFilesRoute({
  projectData,
  requireToken,
}: CreateAssetFilesRouteOptions) {
  return new Hono()
    .get('/asset-files', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const request = readAssetFilePageRequest(c.req.query());
        const page = await projectData.listAssetFilePage({
          projectName,
          ...request,
        });
        return c.json({
          page: {
            ...page,
            items: page.items.map((assetFile) =>
              toStudioAssetFileResponse(projectName, assetFile)
            ),
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/asset-files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        return await readProjectAssetFileByIdResponse(projectData, {
          projectName,
          assetFileId,
        }, c.req.raw);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/selected-cover/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.selectAssetFile({
          projectName,
          target: { kind: 'project' },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/selected-cover', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const report = await projectData.clearAssetFileSelection({
          projectName,
          target: { kind: 'project' },
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/covers/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.discardAssetFile({
          projectName,
          owner: { kind: 'project' },
          assetFileId,
          expectedType: 'project_cover',
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/asset-files', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const page = await projectData.listAssetFilePage({
          projectName,
          owner: { kind: 'castMember', id: castMemberId },
          ...readPageRequest(c.req.query()),
        });
        const responsePage = {
          ...page,
          items: page.items.map((assetFile) =>
            toStudioAssetFileResponse(projectName, assetFile)
          ),
        };
        return c.json({ page: responsePage });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/voices', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const report = await projectData.listCastVoices({
          projectName,
          castMemberId,
        });
        return c.json({ voices: report.voices });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/voices/:voiceId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const voiceIdOrName = c.req.param('voiceId') as string;
        const report = await projectData.readCastVoice({
          projectName,
          castMemberId,
          voiceIdOrName,
        });
        return c.json({ voice: report.voice });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/cast/:castMemberId/voices/:voiceId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const voiceIdOrName = c.req.param('voiceId') as string;
        const report = await projectData.removeCastVoice({
          projectName,
          castMemberId,
          voiceIdOrName,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/cast/:castMemberId/selected-profile/:assetFileId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const report = await projectData.selectAssetFile({
            projectName,
            target: { kind: 'castMember', id: castMemberId },
            assetFileId,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/cast/:castMemberId/selected-profile',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const report = await projectData.clearAssetFileSelection({
            projectName,
            target: { kind: 'castMember', id: castMemberId },
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete('/cast/:castMemberId/asset-files/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.discardAssetFile({
          projectName,
          owner: { kind: 'castMember', id: castMemberId },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/locations/:locationId/asset-files', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const page = await projectData.listAssetFilePage({
          projectName,
          owner: { kind: 'location', id: locationId },
          ...readPageRequest(c.req.query()),
        });
        const responsePage = {
          ...page,
          items: page.items.map((assetFile) =>
            toStudioAssetFileResponse(projectName, assetFile)
          ),
        };
        return c.json({ page: responsePage });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/locations/:locationId/selected-hero/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.selectAssetFile({
          projectName,
          target: { kind: 'location', id: locationId },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/locations/:locationId/selected-hero', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const report = await projectData.clearAssetFileSelection({
          projectName,
          target: { kind: 'location', id: locationId },
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/locations/:locationId/asset-files/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.discardAssetFile({
          projectName,
          owner: { kind: 'location', id: locationId },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/props/:propId/asset-files', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const propId = c.req.param('propId') as string;
        const page = await projectData.listAssetFilePage({
          projectName,
          owner: { kind: 'prop', id: propId },
          ...readPageRequest(c.req.query()),
        });
        const responsePage = {
          ...page,
          items: page.items.map((assetFile) =>
            toStudioAssetFileResponse(projectName, assetFile)
          ),
        };
        return c.json({ page: responsePage });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/props/:propId/selected-hero/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const propId = c.req.param('propId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.selectAssetFile({
          projectName,
          target: { kind: 'prop', id: propId },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/props/:propId/selected-hero', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const propId = c.req.param('propId') as string;
        const report = await projectData.clearAssetFileSelection({
          projectName,
          target: { kind: 'prop', id: propId },
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/props/:propId/asset-files/:assetFileId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const propId = c.req.param('propId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.discardAssetFile({
          projectName,
          owner: { kind: 'prop', id: propId },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
