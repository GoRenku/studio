import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { createBlankMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

async function fixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cleanup-'));
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const service = createProjectDataService();
  const input = { homeDir, projectName: 'cleanup' };
  const created = await createBlankMovieProject({ projectData: service, ...input, title: 'Cleanup' });
  if (!created) {
    throw new Error('SQLite fixture unavailable');
  }
  return { service, input, root: created.projectPath, homeDir };
}

afterEach(() => vi.restoreAllMocks());

describe('Explicit project temporary-file cleanup', () => {
  it('clears only top-level tmp contents and unlinks links without following them', async () => {
    const f = await fixture();
    await fs.mkdir(path.join(f.root, 'tmp/media/frames'), { recursive: true });
    await fs.writeFile(path.join(f.root, 'tmp/media/frames/0001.png'), 'frame');
    await fs.mkdir(path.join(f.root, 'scenes/01/previs'), { recursive: true });
    await fs.writeFile(path.join(f.root, 'scenes/01/previs/source.py'), 'source');
    const outside = path.join(f.homeDir, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'keep'), 'keep');
    await fs.symlink(outside, path.join(f.root, 'tmp/link'));
    const result = await f.service.cleanProjectTemporaryFiles(f.input);
    expect(result.removedFiles).toBe(2);
    expect(result.removedBytes).toBeGreaterThanOrEqual(5);
    expect(await fs.readdir(path.join(f.root, 'tmp'))).toEqual([]);
    expect(await fs.readFile(path.join(outside, 'keep'), 'utf8')).toBe('keep');
    expect(await fs.readFile(path.join(f.root, 'scenes/01/previs/source.py'), 'utf8')).toBe('source');
    expect(await f.service.cleanProjectTemporaryFiles(f.input)).toEqual({ removedFiles: 0, removedBytes: 0 });
  });

  it('treats missing tmp as empty and refuses a linked tmp root', async () => {
    const f = await fixture();
    expect(await f.service.cleanProjectTemporaryFiles(f.input)).toEqual({ removedFiles: 0, removedBytes: 0 });
    await fs.symlink(f.homeDir, path.join(f.root, 'tmp'));
    await expect(f.service.cleanProjectTemporaryFiles(f.input)).rejects.toMatchObject({ code: 'CORE_PROJECT_TMP_INVALID' });
  });

  it('reports a partial failure with removed counts and leaves remaining files', async () => {
    const f = await fixture();
    await fs.mkdir(path.join(f.root, 'tmp'));
    await fs.writeFile(path.join(f.root, 'tmp/a'), 'abc');
    await fs.writeFile(path.join(f.root, 'tmp/b'), 'def');
    const unlink = fs.unlink.bind(fs);
    vi.spyOn(fs, 'unlink').mockImplementation(async (target) => {
      if (String(target).endsWith('/b')) {
        throw new Error('permission denied');
      }
      return unlink(target);
    });
    await expect(f.service.cleanProjectTemporaryFiles(f.input)).rejects.toMatchObject({
      code: 'CORE_PROJECT_TMP_CLEANUP_FAILED', message: expect.stringContaining('1 files (3 bytes)'),
    });
    expect(await fs.readdir(path.join(f.root, 'tmp'))).toEqual(['b']);
  });
});
