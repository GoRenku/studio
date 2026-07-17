import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAssetCommand } from './asset-command.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

const projectData = vi.hoisted(() => ({
  updateAssetReference: vi.fn(),
  listAssets: vi.fn(),
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
        assetId: 'asset_1',
        target: { kind: 'castMember' as const, castMemberId: 'cast_1' },
      },
      resourceKeys: ['surface:castMember:cast_1'],
    };
    projectData.updateAssetReference.mockResolvedValue(report);
    const stdout = { log: vi.fn() };

    const exitCode = await runAssetCommand({
      input: ['reference-update', 'asset_1'],
      flags: {
        project: 'movie',
        target: 'cast:cast_1',
        referenceName: 'hero-profile',
      },
      json: true,
      io: { stdout, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(exitCode).toBe(0);
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledTimes(1);
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ report, command: 'asset reference-update' })
    );
    expect(JSON.parse(stdout.log.mock.calls[0]![0])).toMatchObject({
      asset: { assetId: 'asset_1' },
      resourceKeys: ['surface:castMember:cast_1'],
      warnings: [expect.objectContaining({ code: 'CLI045' })],
    });
  });
});
