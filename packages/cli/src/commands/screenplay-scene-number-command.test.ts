import { describe, expect, it, vi } from 'vitest';
import type { ProjectDataService } from '@gorenku/studio-core/server';
import { runScreenplaySceneNumberCommand } from './screenplay-scene-number-command.js';

describe('screenplay scene-number command', () => {
  it('lists production scene numbers through Core', async () => {
    const service = serviceWithSceneNumbers();
    vi.mocked(service.listSceneProductionNumbers).mockResolvedValue({
      valid: true,
      warnings: [],
      project: { name: 'constantinople' },
      sceneNumbers: [],
    });

    await expect(
      runScreenplaySceneNumberCommand({
        subcommand: 'list',
        homeDir: '/tmp/renku-home',
        service,
      })
    ).resolves.toMatchObject({ sceneNumbers: [] });
    expect(service.listSceneProductionNumbers).toHaveBeenCalledWith({
      homeDir: '/tmp/renku-home',
    });
  });

  it('passes the authored number to the Core resolver unchanged', async () => {
    const service = serviceWithSceneNumbers();
    vi.mocked(service.resolveSceneProductionNumber).mockResolvedValue({
      valid: true,
      warnings: [],
      project: { name: 'constantinople' },
      scene: {
        productionNumber: '22A',
        sceneId: 'scene_inserted',
        title: 'Inserted Scene',
      },
    });

    await runScreenplaySceneNumberCommand({
      subcommand: 'resolve',
      productionNumber: ' 022a ',
      homeDir: '/tmp/renku-home',
      service,
    });
    expect(service.resolveSceneProductionNumber).toHaveBeenCalledWith({
      homeDir: '/tmp/renku-home',
      productionNumber: ' 022a ',
    });
  });

  it('requires --number for resolution', async () => {
    await expect(
      runScreenplaySceneNumberCommand({
        subcommand: 'resolve',
        service: serviceWithSceneNumbers(),
      })
    ).rejects.toMatchObject({ code: 'CLI090' });
  });
});

function serviceWithSceneNumbers(): ProjectDataService {
  return {
    listSceneProductionNumbers: vi.fn(),
    resolveSceneProductionNumber: vi.fn(),
  } as unknown as ProjectDataService;
}
