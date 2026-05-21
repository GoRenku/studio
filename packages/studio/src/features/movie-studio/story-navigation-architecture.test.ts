import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const movieStudioSourceRoot = path.dirname(fileURLToPath(import.meta.url));

describe('Movie Studio story navigation architecture', () => {
  it('keeps feature code off legacy nested ProjectShell story arrays', async () => {
    const files = await listTypeScriptFiles(movieStudioSourceRoot);
    const featureFiles = files.filter(
      (file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')
    );
    const forbiddenNeedles = [
      'project.sequences',
      "ProjectShellWithHttp['sequences']",
    ];
    const offenders: string[] = [];

    for (const file of featureFiles) {
      const source = await fs.readFile(file, 'utf8');
      if (forbiddenNeedles.some((needle) => source.includes(needle))) {
        offenders.push(path.relative(movieStudioSourceRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

async function listTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(absolutePath);
      }
      return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
    })
  );
  return files.flat();
}
