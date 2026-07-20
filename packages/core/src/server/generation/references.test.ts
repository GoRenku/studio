import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveGenerationReferenceProjectFile } from './references.js';

describe('generation project-file reference safety', () => {
  let projectFolder: string;
  let outsideFolder: string;

  beforeEach(async () => {
    projectFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-reference-project-'));
    outsideFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-reference-outside-'));
  });

  it('resolves an exact supported file with browser-safe metadata', async () => {
    await fs.mkdir(path.join(projectFolder, 'research'));
    await fs.writeFile(path.join(projectFolder, 'research', 'helmet.jpg'), 'reference');

    await expect(resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath: 'research/helmet.jpg',
    })).resolves.toMatchObject({
      projectRelativePath: 'research/helmet.jpg',
      mediaKind: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 9,
    });
  });

  it('rejects traversal, unsupported media, missing files, and symlink escape', async () => {
    await fs.mkdir(path.join(projectFolder, 'research'));
    await fs.writeFile(path.join(outsideFolder, 'outside.jpg'), 'outside');
    await fs.symlink(
      path.join(outsideFolder, 'outside.jpg'),
      path.join(projectFolder, 'research', 'escape.jpg'),
    );

    await expect(resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath: '../outside.jpg',
    })).rejects.toMatchObject({ code: expect.any(String) });
    await expect(resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath: 'research/notes.txt',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_REFERENCE_FILE_MEDIA_UNSUPPORTED',
    });
    await expect(resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath: 'research/missing.jpg',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_REFERENCE_FILE_NOT_FOUND',
    });
    await expect(resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath: 'research/escape.jpg',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_REFERENCE_FILE_OUTSIDE_PROJECT',
    });
  });
});
