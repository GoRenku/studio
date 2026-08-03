import { describe, expect, it, vi } from 'vitest';
import type { ProjectDataService } from '@gorenku/studio-core/server';
import { runScreenplaySceneNumberCommand } from './scene-numbers.js';

describe('screenplay scene-number command', () => {
  it('lists production scene numbers through Core', async () => {
    const service = serviceWithSceneNumbers();
    vi.mocked(service.listSceneProductionNumbers).mockResolvedValue({
      project: { id: 'project_1', projectName: 'constantinople' },
      sceneNumbers: [],
      resourceKeys: ['surface:screenplay'],
    });
    const output: string[] = [];

    await expect(runScreenplaySceneNumberCommand(context({
      input: ['scene-number', 'list'],
      flags: { project: 'constantinople' },
      service,
      output,
    }))).resolves.toBe(0);
    expect(service.listSceneProductionNumbers).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
    });
    expect(JSON.parse(output[0]!)).toMatchObject({ sceneNumbers: [] });
  });

  it('passes the authored number to the Core resolver unchanged', async () => {
    const service = serviceWithSceneNumbers();
    vi.mocked(service.resolveSceneProductionNumber).mockResolvedValue({
      project: { id: 'project_1', projectName: 'constantinople' },
      scene: {
        productionNumber: '22A',
        sceneId: 'scene_inserted',
        heading: 'INT. WORKSHOP - DAY',
        title: 'Inserted Scene',
      },
      resourceKeys: ['surface:screenplay'],
    });

    await runScreenplaySceneNumberCommand(context({
      input: ['scene-number', 'resolve'],
      flags: { project: 'constantinople', number: ' 022a ' },
      service,
    }));
    expect(service.resolveSceneProductionNumber).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
      productionNumber: ' 022a ',
    });
  });

  it('requires --number for resolution', async () => {
    await expect(runScreenplaySceneNumberCommand(context({
      input: ['scene-number', 'resolve'],
      flags: { project: 'constantinople' },
      service: serviceWithSceneNumbers(),
    }))).rejects.toMatchObject({ code: 'CLI090' });
  });
});

function serviceWithSceneNumbers(): ProjectDataService {
  return {
    resolveStudioProjectRef: vi.fn().mockResolvedValue({
      id: 'project_1',
      name: 'constantinople',
      storageRoot: '/tmp/movies',
    }),
    listSceneProductionNumbers: vi.fn(),
    resolveSceneProductionNumber: vi.fn(),
  } as unknown as ProjectDataService;
}

function context(input: {
  input: string[];
  flags: { project?: string; number?: string };
  service: ProjectDataService;
  output?: string[];
}) {
  return {
    input: input.input,
    flags: input.flags,
    json: true,
    io: {
      stdout: { log: (message: string) => input.output?.push(message) },
      stderr: { error: vi.fn() },
    },
    homeDir: '/tmp/renku-home',
    service: input.service,
  };
}
