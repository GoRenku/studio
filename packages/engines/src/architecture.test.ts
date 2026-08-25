import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('standalone Engines architecture', () => {
  it('has no Studio workspace dependency or import', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    };
    expect(Object.keys(dependencies).filter((name) => name.startsWith('@gorenku/studio-')))
      .toEqual([]);

    const sources = await readSources(path.join(packageRoot, 'src'));
    expect(sources.join('\n')).not.toMatch(/@gorenku\/studio-|#core/);
    expect(Object.values(manifest.scripts ?? {}).join('\n')).not.toMatch(/build:core|packages\/core/);
  });
});

async function readSources(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const sources = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return readSources(absolute);
    }
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) {
      return [];
    }
    return [await fs.readFile(absolute, 'utf8')];
  }));
  return sources.flat();
}
