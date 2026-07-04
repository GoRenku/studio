import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const generationSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const pricingSourceRoot = path.join(generationSourceRoot, 'pricing');

describe('generation module architecture', () => {
  it('keeps pricing independent from execution and provider handoff modules', async () => {
    const files = (await listTypeScriptFiles(pricingSourceRoot)).filter(
      (file) => !file.endsWith('.test.ts')
    );
    const offenders: Array<{ file: string; importSource: string; reason: string }> =
      [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      for (const importSource of extractImportSources(source)) {
        const reason = forbiddenPricingImportReason(importSource);
        if (reason) {
          offenders.push({
            file: path.relative(generationSourceRoot, file),
            importSource,
            reason,
          });
        }
      }
    }

    expect(
      offenders,
      [
        'Engine pricing must stay a price-facts module.',
        'It may read catalog pricing facts and generation pricing contracts,',
        'but it must not import execution, provider payload, input-file, SDK, output persistence, or filesystem modules.',
      ].join(' ')
    ).toEqual([]);
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

function extractImportSources(source: string): string[] {
  const importSourcePattern =
    /(?:from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  const importSources: string[] = [];
  for (const match of source.matchAll(importSourcePattern)) {
    const importSource = match[1] ?? match[2];
    if (importSource) {
      importSources.push(importSource);
    }
  }
  return importSources;
}

function forbiddenPricingImportReason(importSource: string): string | null {
  if (importSource.startsWith('../execution') || importSource.includes('/execution/')) {
    return 'pricing must not import generation execution';
  }
  if (importSource.startsWith('../../sdk') || importSource.includes('/sdk/')) {
    return 'pricing must not import provider SDK modules';
  }
  if (importSource === 'node:fs' || importSource === 'node:path') {
    return 'pricing must not read or write provider input/output files';
  }
  if (importSource.includes('provider-payload')) {
    return 'pricing must not build or validate provider payloads';
  }
  if (importSource.includes('input-file')) {
    return 'pricing must not load generation input files';
  }
  if (importSource.includes('runner')) {
    return 'pricing must not import generation runners';
  }
  return null;
}
