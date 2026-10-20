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

  it('keeps FDX parsing server-only and confines XML library imports to the parser boundary', async () => {
    const serverFolder = dirname(fileURLToPath(import.meta.url));
    const fdxFiles = await sourceFiles(join(serverFolder, 'screenplay', 'fdx'));
    const fdxSources = await Promise.all(
      fdxFiles.map(async (file) => ({ file, source: await readFile(file, 'utf8') })),
    );
    expect(fdxSources.map((entry) => entry.source).join('\n')).not.toMatch(
      /from ['"](?:react|hono|meow)['"]/,
    );
    expect(
      fdxSources
        .filter((entry) => entry.source.includes("from '@rgrove/parse-xml'"))
        .every((entry) => entry.file.includes('/parser/')),
    ).toBe(true);

    const clientFiles = await sourceFiles(join(serverFolder, '..', 'client'));
    const clientSources = await Promise.all(
      clientFiles.map((file) => readFile(file, 'utf8')),
    );
    expect(clientSources.join('\n')).not.toMatch(/screenplay\/fdx/);
  });

  it('sends usage statistics only from the Core telemetry module', async () => {
    const packagesFolder = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const telemetryFolder = join(dirname(fileURLToPath(import.meta.url)), 'telemetry');
    const senders: string[] = [];
    for (const packageName of ['core', 'cli', 'codex', 'studio']) {
      for (const file of await packageSourceFiles(join(packagesFolder, packageName))) {
        if ((await readFile(file, 'utf8')).includes('i.posthog.com')) {
          senders.push(file);
        }
      }
    }
    expect(senders.length).toBeGreaterThan(0);
    expect(senders.filter((file) => !file.startsWith(telemetryFolder))).toEqual([]);
  });

  it('reads stored profile descriptions only through the database access layer', async () => {
    const serverFolder = dirname(fileURLToPath(import.meta.url));
    const importers: string[] = [];
    for (const file of await sourceFiles(serverFolder)) {
      if (/from ['"][./]*profile-descriptions\/validator\.js['"]/.test(await readFile(file, 'utf8'))) {
        importers.push(file);
      }
    }
    expect(importers.length).toBeGreaterThan(0);
    expect(
      importers.filter((file) => !file.startsWith(join(serverFolder, 'database', 'access'))),
    ).toEqual([]);
  });

  it('keeps Core independent from Engines and provider SDKs', async () => {
    const coreFolder = join(dirname(fileURLToPath(import.meta.url)), '..');
    const sources = await Promise.all(
      (await sourceFiles(coreFolder)).map((file) => readFile(file, 'utf8')),
    );
    expect(sources.join('\n')).not.toMatch(
      /from ['"](?:@gorenku\/studio-engines|@fal-ai\/client|replicate|@elevenlabs\/elevenlabs-js)['"]/,
    );
  });

  it('keeps Core independent from the Codex panel runtime', async () => {
    const coreFolder = join(dirname(fileURLToPath(import.meta.url)), '..');
    const sources = await Promise.all(
      (await sourceFiles(coreFolder)).map((file) => readFile(file, 'utf8')),
    );
    expect(sources.join('\n')).not.toMatch(/from ['"]@gorenku\/studio-codex(?:\/[^'"]*)?['"]/);
  });

  it('keeps media generation context independent from provider and UI capabilities', async () => {
    const folder = join(dirname(fileURLToPath(import.meta.url)), 'media-generation-context');
    const sources = await Promise.all(
      (await sourceFiles(folder)).map((file) => readFile(file, 'utf8')),
    );
    const source = sources.join('\n');

    expect(source).not.toMatch(/from ['"](?:@gorenku\/studio-engines|react|hono|meow)['"]/);
    expect(source).not.toMatch(/provider-credentials|provider-registry|supported-models/);
  });
});

async function packageSourceFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', 'dist-server', 'dist-codex'].includes(entry.name) ? [] : packageSourceFiles(path);
    }
    return /\.(?:ts|tsx|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

async function sourceFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  }));
  return nested.flat();
}
