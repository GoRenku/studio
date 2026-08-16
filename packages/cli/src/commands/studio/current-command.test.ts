import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudioCoordinationService } from '@gorenku/studio-core/server';
import { runStudioCurrentCommand } from './current-command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  createStudioCoordinationService: vi.fn(),
}));

describe('studio current command', () => {
  const readStudioCurrent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createStudioCoordinationService).mockReturnValue({
      readStudioCurrent,
    } as never);
  });

  it('includes the Screenplay focus in the human-readable summary', async () => {
    readStudioCurrent.mockResolvedValue({
      studio: { running: true },
      project: {
        id: 'project_test',
        name: 'constantinople',
        title: 'Constantinople',
      },
      selection: { type: 'screenplay' },
      context: {
        kind: 'screenplay',
        projectTitle: 'Constantinople',
        scenes: [],
      },
      pendingRequest: null,
      warnings: [],
    });
    const stdout: string[] = [];

    const exitCode = await runStudioCurrentCommand({
      input: ['current'],
      json: false,
      io: captureIo(stdout),
      homeDir: '/tmp/home',
    });

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      'Current Studio project: constantinople',
      'Focus: Screenplay',
    ]);
  });
});

function captureIo(stdout: string[]) {
  return {
    stdout: { log: (message: string) => stdout.push(message) },
    stderr: { error: () => undefined },
  };
}
