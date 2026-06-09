import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const studioSourceRoot = path.dirname(fileURLToPath(import.meta.url));

describe('Studio frontend architecture', () => {
  it('keeps Studio resource-change subscriptions in the shared refresh hook', async () => {
    const files = await listTypeScriptFiles(studioSourceRoot);
    const listenerFiles: string[] = [];
    const localDetailTypeFiles: string[] = [];

    for (const file of files.filter((candidate) => !candidate.endsWith('.test.tsx') && !candidate.endsWith('.test.ts'))) {
      const source = await fs.readFile(file, 'utf8');
      if (
        source.includes("addEventListener('renku:studio-resource-changed'") ||
        source.includes('addEventListener("renku:studio-resource-changed"')
      ) {
        listenerFiles.push(relativeSourcePath(file));
      }
      if (
        source.includes('interface StudioResourceChangedDetail') &&
        !file.endsWith(
          path.join('hooks', 'use-studio-resource-refresh.ts')
        )
      ) {
        localDetailTypeFiles.push(relativeSourcePath(file));
      }
    }

    expect(listenerFiles).toEqual(['hooks/use-studio-resource-refresh.ts']);
    expect(localDetailTypeFiles).toEqual([]);
  });
});

async function listTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(resolved);
      }
      if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
      ) {
        return [resolved];
      }
      return [];
    })
  );
  return files.flat();
}

function relativeSourcePath(file: string): string {
  return path.relative(studioSourceRoot, file).split(path.sep).join('/');
}
