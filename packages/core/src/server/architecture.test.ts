import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectSourceRoot = path.dirname(fileURLToPath(import.meta.url));

describe('core server architecture', () => {
  it('does not revive the broad project resource query module', async () => {
    await expect(
      fs.access(path.join(projectSourceRoot, 'project-resource-queries.ts'))
    ).rejects.toThrow();
  });

  it('keeps ProjectDataService as a small facade over commands and resources', async () => {
    const source = await fs.readFile(
      path.join(projectSourceRoot, 'project-data-service.ts'),
      'utf8'
    );
    const lineCount = source.split('\n').length;
    const forbiddenNeedles = [
      'node:fs',
      'node:path',
      'session.db',
      'openProjectStore',
      'readProjectSetupOrThrow',
      'readNarrativeStarterOrThrow',
    ];

    expect(lineCount).toBeLessThanOrEqual(140);
    expect(
      forbiddenNeedles.filter((needle) => source.includes(needle))
    ).toEqual([]);
  });

  it('keeps runtime project data access off direct SQLite prepare calls', async () => {
    const files = await listTypeScriptFiles(projectSourceRoot);
    const runtimeFiles = files.filter(
      (file) =>
        !file.endsWith('.test.ts') &&
        path.relative(projectSourceRoot, file) !==
          path.join('database', 'lifecycle', 'store.ts')
    );
    const forbiddenNeedle = ['session', '.', 'sqlite', '.', 'prepare'].join('');
    const offenders: string[] = [];

    for (const file of runtimeFiles) {
      const source = await fs.readFile(file, 'utf8');
      if (source.includes(forbiddenNeedle)) {
        offenders.push(path.relative(projectSourceRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not keep the old node source boundary', async () => {
    await expect(
      fs.access(path.join(projectSourceRoot, '..', 'node'))
    ).rejects.toThrow();
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
      return entry.isFile() && entry.name.endsWith('.ts') ? [absolutePath] : [];
    })
  );
  return files.flat();
}
