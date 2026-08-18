import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';
import { runLocationWorldCommand } from './location-world-command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  createProjectDataService: vi.fn(),
}));
vi.mock('./studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('Location World command', () => {
  const generateLocationWorld = vi.fn();
  const readLocationWorldResource = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createProjectDataService).mockReturnValue({
      generateLocationWorld,
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
    const file = path.join(directory, 'generation.json');
    await fs.writeFile(file, JSON.stringify(document), 'utf8');
    const report = {
      valid: true,
      selectedAssetId: 'asset_world',
      resourceKeys: ['location:location_gate'],
    };
    generateLocationWorld.mockResolvedValue(report);
    const stdout: string[] = [];

    await runLocationWorldCommand({
      input: ['generate'],
      flags: { file },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/home',
    });

    expect(generateLocationWorld).toHaveBeenCalledWith({
      homeDir: '/tmp/home',
      document,
    });
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
