import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

describe('media generation dependency static contracts', () => {
  it('keeps removed shot-video local slot types out of the production module', async () => {
    const source = await readRepoFile(
      'packages/core/src/server/media-generation/shot-video-take.ts'
    );

    expect(source).not.toContain('Required' + 'ShotVideoTakeInputSlot');
    expect(source).not.toContain('required' + 'InputSlots');
    expect(source).not.toContain('reference' + 'BundleSlots');
    expect(source).not.toContain('lookbook' + 'SheetReferenceSlots');
    expect(source).not.toContain('required' + 'SlotForRequestedInput');
    expect(source).not.toContain('required' + 'SlotForInputKind');
    expect(source).not.toContain('dependency' + 'ForInputKind');
    expect(source).not.toContain('to' + 'MediaGenerationDependencySlot');
    expect(source).not.toContain('selector' + 'ForRequiredInputSlot');
  });

  it('keeps dependency-id parsing out of Studio React reference components', async () => {
    const source = await readRepoFile(
      'packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx'
    );

    expect(source).not.toContain('dependencyId' + '.split');
    expect(source).not.toContain('parse' + 'DependencyId');
    expect(source).not.toContain('input' + 'SlotForDependencyId');
  });

  it('keeps obsolete dependency topology fields and imports out of source contracts', async () => {
    const files = [
      'packages/core/src',
      'packages/studio/src',
      'packages/core/tests',
      'packages/studio/src/services',
    ];
    const source = (await Promise.all(files.map(readTree))).join('\n');

    expect(source).not.toContain('execution' + '.levels');
    expect(source).not.toContain('topological' + 'NodeIds');
    expect(source).not.toContain('dependency' + '-map');
    expect(source).not.toContain('dependency' + ' graph');
  });
});

async function readRepoFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function readTree(relativePath: string): Promise<string> {
  const root = path.join(repoRoot, relativePath);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const chunks = await Promise.all(
    entries.map(async (entry) => {
      const child = path.join(relativePath, entry.name);
      if (entry.isDirectory()) {
        return readTree(child);
      }
      if (
        !entry.isFile() ||
        (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))
      ) {
        return '';
      }
      return readRepoFile(child);
    })
  );
  return chunks.join('\n');
}
