import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService, resolveRenkuProviderCredential } from '@gorenku/studio-core/server';
import { generateWorldLabsLocationWorld } from '@gorenku/studio-engines';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';
import { runLocationWorldCommand } from './location-world-command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  createProjectDataService: vi.fn(),
  resolveRenkuProviderCredential: vi.fn(),
}));
vi.mock('@gorenku/studio-engines', () => ({
  generateWorldLabsLocationWorld: vi.fn(),
  isEngineError: () => false,
}));
vi.mock('./studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('Location World command', () => {
  const prepareLocationWorldGeneration = vi.fn();
  const persistLocationWorldGeneration = vi.fn();
  const resolveStudioProjectRef = vi.fn();
  const readLocationWorldResource = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createProjectDataService).mockReturnValue({
      prepareLocationWorldGeneration,
      persistLocationWorldGeneration,
      resolveStudioProjectRef,
      readLocationWorldResource,
    } as never);
  });

  it('delegates the exact generation document and emits one refresh event', async () => {
    const document = {
      kind: 'locationWorldGeneration',
      version: 1,
      locationId: 'location_gate',
      source: {
        kind: 'panorama',
        projectRelativePath: 'tmp/media/location-world/gate/panorama.png',
      },
    };
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'location-world-cli-'));
    const projectName = 'world-project';
    const projectFolder = path.join(directory, projectName);
    await fs.mkdir(projectFolder, { recursive: true });
    const imagePath = path.join(projectFolder, 'source.png');
    await fs.writeFile(imagePath, 'image');
    const file = path.join(directory, 'generation.json');
    await fs.writeFile(file, JSON.stringify(document), 'utf8');
    const report = {
      valid: true,
      selectedAssetId: 'asset_world',
      resourceKeys: ['location:location_gate'],
    };
    prepareLocationWorldGeneration.mockResolvedValue({
      document,
      location: { id: 'location_gate', name: 'Gate' },
      source: { kind: 'panorama', image: { fileName: 'source.png', extension: 'png', mimeType: 'image/png', absolutePath: imagePath } },
    });
    vi.mocked(resolveRenkuProviderCredential).mockResolvedValue('world-key');
    vi.mocked(generateWorldLabsLocationWorld).mockResolvedValue({
      operationId: 'operation_1',
      worldId: 'world_1',
      body: new Response('spz').body!,
      contentLength: 3,
      mediaKind: 'model',
      mimeType: 'application/octet-stream',
      extension: 'spz',
    });
    resolveStudioProjectRef.mockResolvedValue({ storageRoot: directory, name: projectName });
    persistLocationWorldGeneration.mockResolvedValue(report);
    const stdout: string[] = [];

    await runLocationWorldCommand({
      input: ['generate'],
      flags: { file },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/home',
    });

    expect(prepareLocationWorldGeneration).toHaveBeenCalledWith({
      homeDir: '/tmp/home',
      document,
    });
    expect(generateWorldLabsLocationWorld).toHaveBeenCalledOnce();
    expect(persistLocationWorldGeneration).toHaveBeenCalledWith(expect.objectContaining({
      homeDir: '/tmp/home',
      document,
      provider: { operationId: 'operation_1', worldId: 'world_1' },
    }));
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledOnce();
    expect(JSON.parse(stdout[0]!)).toEqual(report);
  });

  it('reads only the selected World for the exact Location', async () => {
    const resource = { location: { id: 'location_gate' }, selectedWorld: null };
    readLocationWorldResource.mockResolvedValue(resource);
    const stdout: string[] = [];

    await runLocationWorldCommand({
      input: ['show'],
      flags: { location: 'location_gate' },
      json: true,
      io: captureIo(stdout),
    });

    expect(readLocationWorldResource).toHaveBeenCalledWith({
      homeDir: undefined,
      locationId: 'location_gate',
    });
    expect(JSON.parse(stdout[0]!)).toEqual(resource);
  });
});

function captureIo(stdout: string[]) {
  return {
    stdout: { log: (message: string) => stdout.push(message) },
    stderr: { error: () => undefined },
  };
}
