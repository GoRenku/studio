import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveTemporaryFileRoot,
  writeProjectTemporaryFile,
} from './temporary-files.js';

describe('project temporary files', () => {
  it.each([
    [{ kind: 'generation.media', purpose: 'cast.profile' }, 'tmp/media'],
    [{ kind: 'generation.spec' }, 'tmp/specs'],
    [{ kind: 'generation.receipt' }, 'tmp/receipts'],
    [{ kind: 'operation' }, 'tmp/operations'],
    [{ kind: 'qa' }, 'tmp/qa'],
    [{ kind: 'scratch' }, 'tmp/scratch'],
  ] as const)('maps %j to %s', async (destination, expected) => {
    await expect(resolveTemporaryFileRoot({
      projectFolder: '/project',
      destination,
    })).resolves.toBe(expected);
  });

  it('writes inside the owned category and allocates collisions safely', async () => {
    const projectFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-project-temporary-file-')
    );

    const first = await writeProjectTemporaryFile({
      projectFolder,
      destination: { kind: 'operation' },
      fileNameHint: '../Cast Operations.JSON',
      contents: Buffer.from('first'),
    });
    const second = await writeProjectTemporaryFile({
      projectFolder,
      destination: { kind: 'operation' },
      fileNameHint: '../Cast Operations.JSON',
      contents: Buffer.from('second'),
    });

    expect(first.projectRelativePath).toBe('tmp/operations/cast-operations.json');
    expect(second.projectRelativePath).toBe('tmp/operations/cast-operations-2.json');
    await expect(fs.readFile(first.absolutePath, 'utf8')).resolves.toBe('first');
    await expect(fs.readFile(second.absolutePath, 'utf8')).resolves.toBe('second');
    expect(path.relative(projectFolder, first.absolutePath)).not.toMatch(/^\.\./);
    expect(path.relative(projectFolder, second.absolutePath)).not.toMatch(/^\.\./);
  });
});
