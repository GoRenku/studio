import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import { runScreenplayFdxImportCommand } from './fdx-import.js';

vi.mock('../studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('screenplay import-fdx command', () => {
  beforeEach(() => {
    vi.mocked(appendStudioResourceChangedEvent).mockResolvedValue(undefined);
  });

  it('passes only project and source arguments to Core and emits the JSON report', async () => {
    const service = importService();
    vi.mocked(service.importFdxScreenplay).mockResolvedValue(report());
    const output: string[] = [];

    await expect(runScreenplayFdxImportCommand(context({
      service,
      json: true,
      output,
    }))).resolves.toBe(0);

    expect(service.importFdxScreenplay).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/renku-home',
      sourcePath: '/tmp/script.fdx',
    });
    expect(JSON.parse(output[0]!)).toMatchObject({
      screenplayImport: { sha256: 'abc123' },
      counts: { scenes: 2 },
    });
  });

  it('keeps human output focused on useful import facts', async () => {
    const service = importService();
    vi.mocked(service.importFdxScreenplay).mockResolvedValue(report());
    const output: string[] = [];

    await runScreenplayFdxImportCommand(context({ service, json: false, output }));

    expect(output.join('\n')).toContain('Imported script.fdx');
    expect(output.join('\n')).toContain('Scenes: 2; Acts: 1; Sequences: 0');
    expect(output.join('\n')).not.toContain('screenplay_import_1');
  });

  it('runs the representative CLI adapter through the real Core service', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-fdx-import-'));
    const storageRoot = path.join(homeDir, 'projects');
    const configDir = path.join(homeDir, '.config', 'renku');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'config.yaml'),
      `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
      'utf8',
    );
    const service = createProjectDataService();
    await service.createMovieProject({
      projectName: 'cli-fdx',
      title: 'CLI FDX',
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
    });
    const sourcePath = path.join(homeDir, 'cli-source.fdx');
    await fs.writeFile(
      sourcePath,
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. CLI ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Action"><Text>The adapter stays thin.</Text></Paragraph>'
      + '</Content></FinalDraft>',
      'utf8',
    );
    const output: string[] = [];

    await runScreenplayFdxImportCommand({
      input: ['import-fdx'],
      flags: { project: 'cli-fdx', file: sourcePath },
      json: true,
      io: {
        stdout: { log: (message: string) => output.push(message) },
        stderr: { error: vi.fn() },
      },
      homeDir,
      service,
    });

    expect(JSON.parse(output[0]!).counts.scenes).toBe(1);
    await expect(service.readScreenplayStructure({
      projectName: 'cli-fdx',
      homeDir,
    })).resolves.toMatchObject({ orderedSceneIds: [expect.any(String)] });
  });
});

function importService(): ProjectDataService {
  return {
    resolveStudioProjectRef: vi.fn().mockResolvedValue({
      id: 'project_1',
      name: 'constantinople',
      storageRoot: '/tmp/movies',
    }),
    importFdxScreenplay: vi.fn(),
  } as unknown as ProjectDataService;
}

function context(input: {
  service: ProjectDataService;
  json: boolean;
  output: string[];
}) {
  return {
    input: ['import-fdx'],
    flags: { project: 'constantinople', file: ' /tmp/script.fdx ' },
    json: input.json,
    io: {
      stdout: { log: (message: string) => input.output.push(message) },
      stderr: { error: vi.fn() },
    },
    homeDir: '/tmp/renku-home',
    service: input.service,
  };
}

function report() {
  return {
    valid: true as const,
    warnings: [] as [],
    project: { id: 'project_1', projectName: 'constantinople' },
    screenplayImport: {
      id: 'screenplay_import_1',
      sourceAssetId: 'asset_1',
      sourceAssetFileId: 'asset_file_1',
      importerVersion: 1 as const,
      importedAt: '2026-08-03T12:00:00.000Z',
      sourceFilename: 'script.fdx',
      sha256: 'abc123',
    },
    counts: {
      scenes: 2,
      acts: 1,
      sequences: 0,
      blocks: 5,
      dialogueTurns: 2,
      productionSceneNumbers: 1,
    },
    candidates: {
      characterCues: [],
      sceneHeadings: [],
      taggedSubjects: [],
    },
    resourceKeys: ['screenplay', 'screenplay:structure'],
  };
}
