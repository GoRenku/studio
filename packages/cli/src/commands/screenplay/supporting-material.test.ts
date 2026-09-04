import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProjectDataService,
  type ImportScreenplaySupportingMaterialReport,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import type { ProjectRelativePath } from '@gorenku/studio-core/client';
import { runScreenplaySupportingMaterialCommand } from './supporting-material.js';

describe('screenplay supporting-material import command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates the Project and source path to Core and prints JSON', async () => {
    const service = importService();
    vi.mocked(service.importScreenplaySupportingMaterial).mockResolvedValue(report());
    const output: string[] = [];

    await expect(runScreenplaySupportingMaterialCommand(context({
      service, json: true, output,
    }))).resolves.toBe(0);

    expect(service.importScreenplaySupportingMaterial).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
      sourcePath: '/tmp/research.pdf',
    });
    expect(JSON.parse(output[0]!)).toMatchObject({
      status: 'imported',
      material: { type: 'screenplay_supporting_material' },
    });
  });

  it('prints imported and unchanged paths without duplicating import logic', async () => {
    const service = importService();
    const output: string[] = [];
    vi.mocked(service.importScreenplaySupportingMaterial)
      .mockResolvedValueOnce(report())
      .mockResolvedValueOnce({ ...report(), status: 'unchanged' });
    const commandContext = context({ service, json: false, output });

    await runScreenplaySupportingMaterialCommand(commandContext);
    await runScreenplaySupportingMaterialCommand(commandContext);

    expect(output).toEqual([
      'Imported supporting material: screenplay/research.pdf',
      'SHA-256: abc123',
      'Supporting material is already imported: screenplay/research.pdf',
    ]);
  });

  it('runs through the real Core service for an empty Project', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-material-'));
    const configDir = path.join(homeDir, '.config', 'renku');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'config.yaml'),
      `version: 0.1.0\nstorageRoot: ${path.join(homeDir, 'projects')}\n`,
      'utf8',
    );
    const service = createProjectDataService();
    await service.createMovieProject({
      projectName: 'cli-material',
      title: 'CLI Material',
      homeDir,
    });
    const sourcePath = path.join(homeDir, 'source-without-extension');
    await fs.writeFile(sourcePath, 'opaque source');
    const output: string[] = [];

    await runScreenplaySupportingMaterialCommand({
      input: ['supporting-material', 'import'],
      flags: { project: 'cli-material', file: sourcePath },
      json: true,
      io: {
        stdout: { log: (message: string) => output.push(message) },
        stderr: { error: vi.fn() },
      },
      homeDir,
      service,
    });

    expect(JSON.parse(output[0]!)).toMatchObject({
      material: {
        files: [{ projectRelativePath: 'screenplay/source-without-extension.bin' }],
      },
    });
  });
});

function importService(): ProjectDataService {
  return {
    resolveStudioProjectRef: vi.fn().mockResolvedValue({
      id: 'project_1',
      name: 'constantinople',
      storageRoot: '/tmp/movies',
    }),
    importScreenplaySupportingMaterial: vi.fn(),
  } as unknown as ProjectDataService;
}

function context(input: {
  service: ProjectDataService;
  json: boolean;
  output: string[];
}) {
  return {
    input: ['supporting-material', 'import'],
    flags: { project: 'constantinople', file: ' /tmp/research.pdf ' },
    json: input.json,
    io: {
      stdout: { log: (message: string) => input.output.push(message) },
      stderr: { error: vi.fn() },
    },
    homeDir: '/tmp/renku-home',
    service: input.service,
  };
}

function report(): ImportScreenplaySupportingMaterialReport {
  return {
    valid: true as const,
    warnings: [] as [],
    status: 'imported' as const,
    project: {
      id: 'project_1',
      projectName: 'constantinople',
      projectFolder: '/tmp/movies/constantinople',
    },
    material: {
      id: 'asset_1',
      owner: { kind: 'project' as const },
      localeId: null,
      type: 'screenplay_supporting_material',
      availability: 'ready' as const,
      mediaKind: 'file',
      title: 'research.pdf',
      oneLineSummary: null,
      origin: 'imported',
      referenceName: null,
      tags: [],
      generationProvenance: null,
      authoredFrom: null,
      files: [{
        id: 'asset_file_1',
        role: 'source',
        projectRelativePath: 'screenplay/research.pdf' as ProjectRelativePath,
        mediaKind: 'file',
        mimeType: 'application/octet-stream',
        sizeBytes: 10,
        contentHash: 'abc123',
        width: null,
        height: null,
        durationSeconds: null,
      }],
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
    resourceKeys: [] as [],
  };
}
