import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  projectDataService: {
    importShotInputMedia: vi.fn(),
  },
}));

vi.mock('@gorenku/studio-core/server', async () => {
  const actual =
    await vi.importActual<typeof import('@gorenku/studio-core/server')>(
      '@gorenku/studio-core/server'
    );
  return {
    ...actual,
    createProjectDataService: vi.fn(() => mocks.projectDataService),
    createStudioOperationId: vi.fn(() => 'operation_test0001'),
  };
});

vi.mock('./commands/studio-resource-event-command.js', () => ({
  appendStudioFocusRequestedEvent: vi.fn(),
  appendStudioResourceChangedEvent: vi.fn(),
}));

import { runRenkuCli, type RenkuCliIo } from './cli.js';

describe('Renku CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectDataService.importShotInputMedia.mockResolvedValue({
      valid: true,
      warnings: [],
      purpose: 'shot.input',
      project: { id: 'project_test0001', name: 'constantinople' },
      changes: [],
      resourceKeys: [],
      target: {
        kind: 'sceneShotVideoTake',
        id: 'take_test0001',
        sceneId: 'scene_test0001',
        takeId: 'take_test0001',
        shotIds: ['shot_001'],
      },
      imported: { assetId: 'asset_first_frame' },
      mediaInput: { inputId: 'scene_shot_video_take_media_input_test0001' },
    });
  });

  it('forwards shot input kind from media import flags', async () => {
    const io = recordingIo();

    const exitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--project',
        'constantinople',
        '--purpose',
        'shot.input',
        '--target',
        'scene:scene_test0001',
        '--take',
        'take_test0001',
        '--source',
        'tmp/media/constantinople-start.png',
        '--kind',
        'first-frame',
        '--selection',
        'select',
        '--json',
      ],
      { io, homeDir: '/tmp/renku-cli-test-home' }
    );

    expect(exitCode).toBe(0);
    expect(io.stderrMessages).toEqual([]);
    expect(mocks.projectDataService.importShotInputMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        homeDir: '/tmp/renku-cli-test-home',
        sceneId: 'scene_test0001',
        takeId: 'take_test0001',
        inputKind: 'first-frame',
        sourceProjectRelativePath: 'tmp/media/constantinople-start.png',
        selection: 'select',
      })
    );
  });
});

function recordingIo(): RenkuCliIo & {
  stdoutMessages: string[];
  stderrMessages: string[];
} {
  const stdoutMessages: string[] = [];
  const stderrMessages: string[] = [];
  return {
    stdoutMessages,
    stderrMessages,
    stdout: {
      log: (message: string) => {
        stdoutMessages.push(message);
      },
    },
    stderr: {
      error: (message: string) => {
        stderrMessages.push(message);
      },
    },
  };
}
