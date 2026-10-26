import { Hono } from 'hono';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeAssetFile } from '../testing/route-fixtures.js';
import { createCastCastingRoute } from './cast-casting.js';

const passThrough = async (_c: unknown, next: () => Promise<void>) => {
  await next();
};

function createMountedCastCastingRoute(projectData = fakeProjectDataService()) {
  return new Hono().route(
    '/:projectName',
    createCastCastingRoute({ projectData, requireToken: passThrough })
  );
}

function putJson(body: unknown) {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('cast casting Hono route', () => {
  it('reads the casting resource with browser URLs and no project paths', async () => {
    const candidate = makeAssetFile('asset_candidate');
    const app = createMountedCastCastingRoute({
      ...fakeProjectDataService(),
      async readCastCastingResource(input) {
        return {
          castMember: { id: input.castMemberId, name: 'Narrator' },
          scenes: [],
          looks: [{
            id: 'look_young',
            castMemberId: input.castMemberId,
            name: 'Young',
            description: null,
            sceneIds: [],
            castCandidateAssetFileId: candidate.id,
            castCandidate: candidate,
            rounds: [{
              id: 'round_1',
              subject: { kind: 'castLook' as const, id: 'look_young' },
              number: 1,
              routes: [{ provider: 'fictional', model: { key: 'model-a', name: 'Model A' }, count: 1 }],
              maxConcurrentGenerations: 1,
              referenceAssetFileIds: [],
              estimatedCost: null,
              createdAt: '2026-10-23T00:00:00.000Z',
              expectedCount: 1,
              candidates: [{ assetFileId: candidate.id, roundId: 'round_1', status: 'candidate' as const, modelKey: 'lumen', model: { key: 'lumen', name: 'Lumen Image' }, assetFile: candidate }],
            }],
          }],
          costumes: [{
            id: 'costume_coat', castMemberId: input.castMemberId, lookId: 'look_young', name: 'Coat', wardrobe: ['Coat'], continuityNotes: [], sceneIds: [], characterSheetAssetFileId: 'asset_sheet',
            rounds: [{
              id: 'round_2',
              subject: { kind: 'castCostume' as const, id: 'costume_coat' },
              number: 1,
              routes: [{ provider: 'fictional', model: { key: 'lumen', name: 'Lumen Image' }, count: 1 }],
              maxConcurrentGenerations: 1,
              referenceAssetFileIds: [],
              estimatedCost: null,
              createdAt: '2026-10-23T00:00:00.000Z',
              expectedCount: 1,
              candidates: [{ assetFileId: 'asset_sheet', roundId: 'round_2', status: 'candidate' as const, modelKey: 'lumen', model: { key: 'lumen', name: 'Lumen Image' }, assetFile: makeAssetFile('asset_sheet') }],
            }],
          }],
        };
      },
    });

    const response = await app.request('/constantinople/cast/cast_narrator/casting');

    expect(response.status).toBe(200);
    const body = await response.json() as { resource: Record<string, unknown> };
    expect(body).toMatchObject({
      resource: {
        castMember: { id: 'cast_narrator' },
        looks: [{
          castCandidate: { id: 'asset_candidate', url: '/studio-api/projects/constantinople/asset-files/asset_candidate' },
          rounds: [{ candidates: [{ assetFile: { url: '/studio-api/projects/constantinople/asset-files/asset_candidate' } }] }],
        }],
        costumes: [{ rounds: [{ candidates: [{ assetFile: { url: '/studio-api/projects/constantinople/asset-files/asset_sheet' } }] }] }],
      },
    });
    expect(JSON.stringify(body)).not.toContain('projectRelativePath');
  });

  it('sets a candidate status through core', async () => {
    const setCastingCandidateStatus = vi.fn(fakeProjectDataService().setCastingCandidateStatus);
    const app = createMountedCastCastingRoute({ ...fakeProjectDataService(), setCastingCandidateStatus });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/casting/candidates/asset_candidate/status',
      putJson({ status: 'hidden' })
    );

    expect(response.status).toBe(200);
    expect(setCastingCandidateStatus).toHaveBeenCalledWith({
      projectName: 'constantinople',
      assetFileId: 'asset_candidate',
      status: 'hidden',
    });
    await expect(response.json()).resolves.toMatchObject({
      candidate: { assetFileId: 'asset_candidate', status: 'hidden' },
      resourceKeys: ['surface:castMember:cast_narrator'],
    });
  });

  it.each([
    [{ status: 'cast' }],
    [{ status: 'hidden', note: 'extra' }],
    ['not an object'],
  ])('rejects an invalid status request %j before calling core', async (body) => {
    const setCastingCandidateStatus = vi.fn(fakeProjectDataService().setCastingCandidateStatus);
    const app = createMountedCastCastingRoute({ ...fakeProjectDataService(), setCastingCandidateStatus });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/casting/candidates/asset_candidate/status',
      putJson(body)
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER364' },
    });
    expect(setCastingCandidateStatus).not.toHaveBeenCalled();
  });

  it('casts a candidate for a Look', async () => {
    const selectAssetFile = vi.fn(fakeProjectDataService().selectAssetFile);
    const app = createMountedCastCastingRoute({ ...fakeProjectDataService(), selectAssetFile });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/looks/look_young/selected-candidate/asset_candidate',
      { method: 'PUT' }
    );

    expect(response.status).toBe(200);
    expect(selectAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'castLook', id: 'look_young' },
      assetFileId: 'asset_candidate',
    });
  });

  it('picks a character sheet for a costume', async () => {
    const selectAssetFile = vi.fn(fakeProjectDataService().selectAssetFile);
    const app = createMountedCastCastingRoute({ ...fakeProjectDataService(), selectAssetFile });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/costumes/costume_cloak/selected-sheet/asset_sheet',
      { method: 'PUT' }
    );

    expect(response.status).toBe(200);
    expect(selectAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'castCostume', id: 'costume_cloak' },
      assetFileId: 'asset_sheet',
    });
  });

  it('serializes core errors', async () => {
    const app = createMountedCastCastingRoute({
      ...fakeProjectDataService(),
      async selectAssetFile() {
        throw createStructuredError({
          code: 'CASTING_CANDIDATE_NOT_FOUND',
          message: 'Casting candidate was not found.',
        });
      },
    });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/looks/look_young/selected-candidate/asset_other',
      { method: 'PUT' }
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CASTING_CANDIDATE_NOT_FOUND' },
    });
  });
});
