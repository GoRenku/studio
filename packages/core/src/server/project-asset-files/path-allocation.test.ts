import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import {
  requiredSemanticFileStem,
  sceneNumberPathSegment,
} from './naming/safe-segments.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFileNamesSync,
} from './path-allocation.js';

describe('project asset file name allocation', () => {
  it('normalizes and bounds semantic names without interpreting their meaning', () => {
    expect(requiredSemanticFileStem('  Warm Stone / Dawn  ')).toBe('warm-stone-dawn');
    expect(requiredSemanticFileStem('A'.repeat(80), 'sheet')).toBe(
      `${'a'.repeat(26)}-sheet`
    );
    expect(() => requiredSemanticFileStem('---', 'sheet')).toThrowError(
      expect.objectContaining({ code: 'PROJECT_ASSET_FILE_SEMANTIC_NAME_REQUIRED' })
    );
  });

  it('keeps Scene numbers opaque while deriving one safe path segment', () => {
    expect(sceneNumberPathSegment('1A', 'scene_one')).toBe('1a');
    expect(sceneNumberPathSegment(' 12/A ', 'scene_twelve')).toBe('12-a');
    expect(sceneNumberPathSegment('..', 'scene_parent')).toBe('scene-parent');
    expect(sceneNumberPathSegment('', 'scene_empty')).toBe('scene-empty');
  });

  it('uses one three-character token and retries real generated collisions', async () => {
    const projectFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-file-token-'));
    await fs.mkdir(path.join(projectFolder, 'cast', 'saruca'), { recursive: true });
    await fs.writeFile(path.join(projectFolder, 'cast', 'saruca', 'profile-g000.jpg'), 'old');
    const tokens = ['000', 'a9z'];

    const names = await allocateProjectAssetFileNames({
      projectFolder,
      parent: normalizeProjectRelativePath('cast/saruca'),
      namingMode: { kind: 'generated' },
      generatedBaseName: 'profile',
      sourceProjectRelativePath: 'tmp/profile.jpeg',
      count: 1,
      tokenSource: () => tokens.shift()!,
    });

    expect(names).toEqual(['profile-ga9z.jpg']);
  });

  it('fails after sixteen generated token collisions', async () => {
    const projectFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-file-token-'));
    await fs.mkdir(path.join(projectFolder, 'cast', 'saruca'), { recursive: true });
    await fs.writeFile(path.join(projectFolder, 'cast', 'saruca', 'profile-g000.png'), 'old');

    await expect(allocateProjectAssetFileNames({
      projectFolder,
      parent: normalizeProjectRelativePath('cast/saruca'),
      namingMode: { kind: 'generated' },
      generatedBaseName: 'profile',
      sourceProjectRelativePath: 'tmp/profile.png',
      count: 1,
      tokenSource: () => '000',
    })).rejects.toMatchObject({
      code: 'PROJECT_ASSET_FILE_GENERATION_TOKEN_ALLOCATION_FAILED',
    });
  });

  it('keeps a safe external basename and adds plain numeric suffixes', async () => {
    const projectFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-file-external-'));
    await fs.mkdir(path.join(projectFolder, 'screenplay'), { recursive: true });
    await fs.writeFile(path.join(projectFolder, 'screenplay', 'urban-basilica.fdx'), 'old');

    expect(allocateProjectAssetFileNamesSync({
      projectFolder,
      parent: normalizeProjectRelativePath('screenplay'),
      namingMode: { kind: 'external' },
      generatedBaseName: 'unused',
      sourceProjectRelativePath: 'imports/Urban Basilica.FDX',
      count: 2,
    })).toEqual(['urban-basilica-2.fdx', 'urban-basilica-3.fdx']);
  });
});
