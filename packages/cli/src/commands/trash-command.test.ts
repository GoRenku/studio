import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDataService } from '@gorenku/studio-core/server';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { runTrashCommand } from './trash-command.js';

vi.mock('@gorenku/studio-core/server', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gorenku/studio-core/server')>();
  return {
    ...actual,
    createProjectDataService: vi.fn(),
  };
});

describe('trash command', () => {
  const service = {
    listTrash: vi.fn(),
    restoreTrashItem: vi.fn(),
    previewGarbageCollection: vi.fn(),
    emptyTrash: vi.fn(),
  } as unknown as ProjectDataService;

  beforeEach(() => {
    vi.mocked(createProjectDataService).mockReturnValue(service);
    vi.mocked(service.listTrash).mockReset();
    vi.mocked(service.restoreTrashItem).mockReset();
    vi.mocked(service.previewGarbageCollection).mockReset();
    vi.mocked(service.emptyTrash).mockReset();
  });

  it('lists Trash as JSON', async () => {
    vi.mocked(service.listTrash).mockResolvedValue({
      valid: true,
      warnings: [],
      project: { id: 'project_test', name: 'constantinople' },
      items: [],
      resourceKeys: ['trash:list'],
    });
    const stdout: string[] = [];

    const status = await runTrashCommand({
      input: ['list'],
      flags: { dryRun: false, project: 'constantinople' },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/renku-home',
    });

    expect(status).toBe(0);
    expect(service.listTrash).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
    });
    expect(JSON.parse(stdout[0]!)).toMatchObject({
      project: { name: 'constantinople' },
      items: [],
    });
  });

  it('restores a Trash item as JSON', async () => {
    vi.mocked(service.restoreTrashItem).mockResolvedValue(recoverableReport());
    const stdout: string[] = [];

    const status = await runTrashCommand({
      input: ['restore'],
      flags: {
        dryRun: false,
        project: 'constantinople',
        trashItem: 'trash_item_test0001',
      },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/renku-home',
    });

    expect(status).toBe(0);
    expect(service.restoreTrashItem).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
      trashItemId: 'trash_item_test0001',
    });
    expect(JSON.parse(stdout[0]!)).toMatchObject({
      recovery: {
        restoreCommand: {
          name: 'trash.restore',
        },
      },
    });
  });

  it('previews and runs Empty Trash as JSON', async () => {
    vi.mocked(service.previewGarbageCollection).mockResolvedValue(
      garbageCollectionPreview()
    );
    vi.mocked(service.emptyTrash).mockResolvedValue({
      ...garbageCollectionPreview(),
      dryRun: false,
      operationId: 'trash_operation_empty',
      manifestProjectRelativePath:
        '.renku/trash/trash_operation_empty/manifest.json',
    });
    const stdout: string[] = [];

    const previewStatus = await runTrashCommand({
      input: ['empty', 'preview'],
      flags: { dryRun: false, project: 'constantinople' },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/renku-home',
    });
    const runStatus = await runTrashCommand({
      input: ['empty', 'run'],
      flags: {
        confirmationToken: 'trash-confirmation-token',
        dryRun: false,
        project: 'constantinople',
      },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/renku-home',
    });

    expect(previewStatus).toBe(0);
    expect(runStatus).toBe(0);
    expect(service.previewGarbageCollection).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
      olderThanIso: undefined,
    });
    expect(service.emptyTrash).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
      olderThanIso: undefined,
      confirmationToken: 'trash-confirmation-token',
      dryRun: false,
    });
  });
});

function captureIo(stdout: string[]) {
  return {
    stdout: { log: (message: string) => stdout.push(message) },
    stderr: { error: vi.fn() },
  };
}

function recoverableReport() {
  return {
    valid: true as const,
    warnings: [],
    project: { id: 'project_test', name: 'constantinople' },
    changes: [{ type: 'trash.restored', itemId: 'trash_item_test0001' }],
    recovery: {
      operationId: 'trash_operation_test0001',
      trashItemIds: ['trash_item_test0001'],
      restorable: true,
      restoreCommand: {
        name: 'trash.restore' as const,
        trashItemId: 'trash_item_test0001',
      },
    },
    resourceKeys: ['trash:list'],
  };
}

function garbageCollectionPreview() {
  return {
    valid: true as const,
    warnings: [],
    project: { id: 'project_test', name: 'constantinople' },
    confirmationToken: 'trash-confirmation-token',
    items: [],
    files: [],
    resourceKeys: ['trash:list'],
  };
}
