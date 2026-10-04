import { parseAssetFileOwner, parseSelectionTarget } from './asset-file/parsing.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runAssetFileCommand,
} from './asset-file/commands.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

const projectData = vi.hoisted(() => ({
  updateAssetFile: vi.fn(),
  listAssetFilePage: vi.fn(),
  importReferenceFiles: vi.fn(),
}));

vi.mock('@gorenku/studio-core/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gorenku/studio-core/server')>()),
  createProjectDataService: () => projectData,
}));
vi.mock('./studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('Asset command', () => {
  const importDirectories: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await Promise.all(importDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true })
    ));
  });

  it.each([
    { owner: 'project', destination: { kind: 'research' } },
    { owner: 'inspirationFolder:folder_1', destination: { kind: 'inspiration', folderId: 'folder_1' } },
  ])('delegates a single reference import for $owner and preserves the Core report', async ({ owner, destination }) => {
    const report = { valid: true, warnings: [], assetFiles: [{ id: 'file_1' }], resourceKeys: [] };
    projectData.importReferenceFiles.mockResolvedValue(report);
    const stdout = { log: vi.fn() };

    const exitCode = await runAssetFileCommand({
      input: ['import'],
      flags: { project: 'movie', owner, source: 'staging/reference.jpg', title: 'Reference' },
      json: true,
      io: { stdout, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(exitCode).toBe(0);
    expect(projectData.importReferenceFiles).toHaveBeenCalledExactlyOnceWith({
      projectName: 'movie',
      destination,
      files: [{ sourceProjectRelativePath: 'staging/reference.jpg', title: 'Reference' }],
      homeDir: '/test-home',
    });
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ report, command: 'asset-file import' })
    );
    expect(JSON.parse(stdout.log.mock.calls[0]![0])).toEqual(report);
  });

  it('reads a batch import document and delegates its envelope unchanged', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), '0222-cli-reference-'));
    importDirectories.push(directory);
    const file = path.join(directory, 'references.json');
    const document = {
      destination: { kind: 'research' },
      files: [
        { sourceProjectRelativePath: 'staging/reference.jpg', title: 'Reference' },
        { sourceProjectRelativePath: 'research/notes.pdf', title: null },
      ],
    };
    await fs.writeFile(file, JSON.stringify(document));
    projectData.importReferenceFiles.mockResolvedValue({ assetFiles: [], resourceKeys: [] });

    await runAssetFileCommand({
      input: ['import'],
      flags: { project: 'movie', file },
      json: true,
      io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(projectData.importReferenceFiles).toHaveBeenCalledExactlyOnceWith({
      ...document, projectName: 'movie', homeDir: '/test-home',
    });
  });

  it('rejects mixed single-file and batch flags before Core delegation', async () => {
    await expect(runAssetFileCommand({
      input: ['import'],
      flags: { project: 'movie', file: '/references.json', owner: 'project', source: 'staging/reference.jpg' },
      json: true,
      io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } },
    })).rejects.toMatchObject({ code: 'CLI_REFERENCE_IMPORT_FLAGS_INVALID' });
    expect(projectData.importReferenceFiles).not.toHaveBeenCalled();
    expect(appendStudioResourceChangedEvent).not.toHaveBeenCalled();
  });

  it.each(['missing', 'invalid'])('reports a structured error for a %s batch document', async (kind) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), '0222-cli-reference-'));
    importDirectories.push(directory);
    const file = path.join(directory, 'references.json');
    if (kind === 'invalid') {
      await fs.writeFile(file, '{');
    }

    await expect(runAssetFileCommand({
      input: ['import'],
      flags: { project: 'movie', file },
      json: true,
      io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } },
    })).rejects.toMatchObject({ code: 'CLI_REFERENCE_IMPORT_DOCUMENT_INVALID' });
    expect(projectData.importReferenceFiles).not.toHaveBeenCalled();
    expect(appendStudioResourceChangedEvent).not.toHaveBeenCalled();
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
      assetFile: {
        id: 'asset_1',
        owner: { kind: 'castMember' as const, id: 'cast_1' },
      },
      resourceKeys: ['surface:castMember:cast_1'],
    };
    projectData.updateAssetFile.mockResolvedValue(report);
    const stdout = { log: vi.fn() };

    const exitCode = await runAssetFileCommand({
      input: ['update', 'asset_1'],
      flags: {
        project: 'movie',
        referenceName: 'hero-profile',
      },
      json: true,
      io: { stdout, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(exitCode).toBe(0);
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledTimes(1);
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ report, command: 'asset-file update' })
    );
    expect(JSON.parse(stdout.log.mock.calls[0]![0])).toMatchObject({
      assetFile: { id: 'asset_1' },
      resourceKeys: ['surface:castMember:cast_1'],
      warnings: [],
    });
  });

  it('parses the public Beat owner and selection syntax', () => {
    expect(parseAssetFileOwner('beat:scene_1:beat_2')).toEqual({
      kind: 'sceneBeat',
      sceneId: 'scene_1',
      beatId: 'beat_2',
    });
    expect(parseSelectionTarget('beat:scene_1:beat_2')).toEqual({
      kind: 'sceneBeat',
      sceneId: 'scene_1',
      beatId: 'beat_2',
    });
    expect(() => parseAssetFileOwner('sceneBeat:scene_1:beat_2')).toThrow(
      'Invalid Asset owner'
    );
  });

  it('parses the independent Location World selection target', () => {
    expect(parseSelectionTarget('location-world:location_gate')).toEqual({
      kind: 'locationWorld',
      id: 'location_gate',
    });
  });

  it('parses the Project Cover selection target', () => {
    expect(parseSelectionTarget('project')).toEqual({ kind: 'project' });
  });

  it('replaces and clears complete tag lists through Core', async () => {
    projectData.updateAssetFile.mockResolvedValue({
      valid: true,
      warnings: [],
      project: { id: 'project_1', projectName: 'movie', projectFolder: '/projects/movie' },
      assetFile: { id: 'asset_1', owner: { kind: 'castMember', id: 'cast_1' } },
      resourceKeys: [],
    });
    const io = { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } };

    await runAssetFileCommand({
      input: ['update', 'asset_1'],
      flags: { project: 'movie', tag: ['storyboard', 'previs'] },
      json: true,
      io,
    });
    expect(projectData.updateAssetFile).toHaveBeenLastCalledWith(expect.objectContaining({
      tags: ['storyboard', 'previs'],
    }));

    await runAssetFileCommand({
      input: ['update', 'asset_1'],
      flags: { project: 'movie', clearTags: true },
      json: true,
      io,
    });
    expect(projectData.updateAssetFile).toHaveBeenLastCalledWith(expect.objectContaining({
      tags: [],
    }));
  });

  it('rejects --tag with --clear-tags before Core delegation', async () => {
    await expect(runAssetFileCommand({
      input: ['update', 'asset_1'],
      flags: { project: 'movie', tag: ['storyboard'], clearTags: true },
      json: true,
      io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } },
    })).rejects.toMatchObject({ code: 'CLI045' });
    expect(projectData.updateAssetFile).not.toHaveBeenCalled();
  });

  it('lists the selected Asset with the owner candidate page', async () => {
    projectData.listAssetFilePage.mockResolvedValue({
      items: [
        {
          id: 'asset_1',
          type: 'shot_image',
        },
      ],
      nextCursor: null,
      selectedAssetFileId: 'asset_1',
    });
    const stdout = { log: vi.fn() };

    const exitCode = await runAssetFileCommand({
      input: ['list'],
      flags: {
        project: 'movie',
        owner: 'shot:shot_1',
        limit: 25,
        cursor: 'cursor_1',
      },
      json: true,
      io: { stdout, stderr: { error: vi.fn() } },
      homeDir: '/test-home',
    });

    expect(exitCode).toBe(0);
    expect(projectData.listAssetFilePage).toHaveBeenCalledWith({
      projectName: 'movie',
      owner: { kind: 'shot', id: 'shot_1' },
      locale: {},
      type: undefined,
      mediaKind: undefined,
      limit: 25,
      cursor: 'cursor_1',
      homeDir: '/test-home',
    });
    expect(JSON.parse(stdout.log.mock.calls[0]![0])).toEqual({
      items: [{ id: 'asset_1', type: 'shot_image' }],
      nextCursor: null,
      selectedAssetFileId: 'asset_1',
    });
  });

  it('prints the next cursor for paged human-readable listings', async () => {
    projectData.listAssetFilePage.mockResolvedValue({
      items: [{ id: 'asset_1', type: 'shot_image' }],
      nextCursor: 'cursor_2',
      selectedAssetFileId: null,
    });
    const stdout = { log: vi.fn() };

    await runAssetFileCommand({
      input: ['list'],
      flags: { project: 'movie', owner: 'shot:shot_1' },
      json: false,
      io: { stdout, stderr: { error: vi.fn() } },
    });

    expect(stdout.log).toHaveBeenLastCalledWith('Next cursor: cursor_2');
  });
});
