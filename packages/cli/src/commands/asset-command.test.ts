import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAssetOwner,
  parseSelectionTarget,
  runAssetCommand,
} from './asset-command.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

const projectData = vi.hoisted(() => ({
  updateAsset: vi.fn(),
  listAssetPage: vi.fn(),
}));

vi.mock('@gorenku/studio-core/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gorenku/studio-core/server')>()),
  createProjectDataService: () => projectData,
}));
vi.mock('./studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('Asset command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies exactly once with the Core mutation report and preserves JSON output', async () => {
    const report = {
      valid: true as const,
      warnings: [],
      project: {
        id: 'project_1',
        name: 'movie',
        projectFolder: '/projects/movie',
      },
      asset: {
        id: 'asset_1',
        owner: { kind: 'castMember' as const, id: 'cast_1' },
      },
      resourceKeys: ['surface:castMember:cast_1'],
    };
    projectData.updateAsset.mockResolvedValue(report);
    const stdout = { log: vi.fn() };

    const exitCode = await runAssetCommand({
      input: ['update', 'asset_1'],
      flags: {
        project: 'movie',
        referenceName: 'hero-profile',
      },
      json: true,
      io: { stdout, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(exitCode).toBe(0);
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledTimes(1);
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ report, command: 'asset update' })
    );
    expect(JSON.parse(stdout.log.mock.calls[0]![0])).toMatchObject({
      asset: { id: 'asset_1' },
      resourceKeys: ['surface:castMember:cast_1'],
      warnings: [],
    });
  });

  it('parses the public Beat owner and selection syntax', () => {
    expect(parseAssetOwner('beat:scene_1:beat_2')).toEqual({
      kind: 'sceneBeat',
      sceneId: 'scene_1',
      beatId: 'beat_2',
    });
    expect(parseSelectionTarget('beat:scene_1:beat_2')).toEqual({
      kind: 'sceneBeat',
      sceneId: 'scene_1',
      beatId: 'beat_2',
    });
    expect(() => parseAssetOwner('sceneBeat:scene_1:beat_2')).toThrow(
      'Invalid Asset owner'
    );
  });

  it('lists the selected Asset with the owner candidate page', async () => {
    projectData.listAssetPage.mockResolvedValue({
      items: [
        {
          id: 'asset_1',
          type: 'shot_image',
        },
      ],
      nextCursor: null,
      selectedAssetId: 'asset_1',
    });
    const stdout = { log: vi.fn() };

    const exitCode = await runAssetCommand({
      input: ['list'],
      flags: {
        project: 'movie',
        owner: 'shot:shot_1',
      },
      json: true,
      io: { stdout, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(exitCode).toBe(0);
    expect(projectData.listAssetPage).toHaveBeenCalledWith({
      projectName: 'movie',
      owner: { kind: 'shot', id: 'shot_1' },
      locale: {},
      type: undefined,
      mediaKind: undefined,
      homeDir: '/test-home',
    });
    expect(JSON.parse(stdout.log.mock.calls[0]![0])).toEqual({
      items: [{ id: 'asset_1', type: 'shot_image' }],
      nextCursor: null,
      selectedAssetId: 'asset_1',
    });
  });
});
