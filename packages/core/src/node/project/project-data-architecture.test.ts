import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectSourceRoot = path.dirname(fileURLToPath(import.meta.url));

describe('project data architecture', () => {
  it('does not revive the broad project resource query module', async () => {
    await expect(
      fs.access(path.join(projectSourceRoot, 'project-resource-queries.ts'))
    ).rejects.toThrow();
  });

  it('keeps runtime project data access off direct SQLite prepare calls', async () => {
    const files = await listTypeScriptFiles(projectSourceRoot);
    const runtimeFiles = files.filter(
      (file) =>
        !file.endsWith('.test.ts') &&
        path.relative(projectSourceRoot, file) !==
          path.join('data', 'sqlite-project-store.ts')
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
