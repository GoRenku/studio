import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Core server architecture boundaries', () => {
  it('keeps generation domain code inside Core and independent from adapters', async () => {
    const folder = join(dirname(fileURLToPath(import.meta.url)), 'generation');
    const files = await sourceFiles(folder);
    const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));

    expect(sources.join('\n')).not.toMatch(/packages\/(?:cli|studio)\//);
    expect(sources.join('\n')).not.toMatch(/from ['"](?:react|hono|meow)['"]/);
  });
});

async function sourceFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  }));
  return nested.flat();
}
