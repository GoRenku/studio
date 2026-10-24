// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  castLookCandidate,
  readCastCasting,
  selectCostumeCharacterSheet,
  setCastingCandidateStatus,
} from './studio-cast-casting-api';

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function lastCall() {
  const fetchMock = vi.mocked(global.fetch);
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
}

describe('studio-cast-casting-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn().mockResolvedValue(okResponse({ resource: { looks: [] } }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the casting resource', async () => {
    await expect(readCastCasting('big fish', 'cast_ed')).resolves.toEqual({ looks: [] });
    expect(lastCall()[0]).toBe('/studio-api/projects/big%20fish/cast/cast_ed/casting');
  });

  it('sends a candidate status with the Studio token', async () => {
    await setCastingCandidateStatus('grid', 'cast_ada', 'asset_a', 'shortlisted');

    const [url, init] = lastCall();
    expect(url).toBe('/studio-api/projects/grid/cast/cast_ada/casting/candidates/asset_a/status');
    expect(init?.method).toBe('PUT');
    expect(new Headers(init?.headers).get('X-Renku-Studio-Token')).toBe('token-123');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'shortlisted' });
  });

  it('casts a Look candidate and picks a costume sheet', async () => {
    await castLookCandidate('grid', 'cast_ada', 'look_young', 'asset_a');
    expect(lastCall()[0]).toBe('/studio-api/projects/grid/cast/cast_ada/looks/look_young/selected-candidate/asset_a');
    expect(lastCall()[1]?.method).toBe('PUT');

    await selectCostumeCharacterSheet('grid', 'cast_ada', 'costume_suit', 'asset_sheet');
    expect(lastCall()[0]).toBe('/studio-api/projects/grid/cast/cast_ada/costumes/costume_suit/selected-sheet/asset_sheet');
  });
});
