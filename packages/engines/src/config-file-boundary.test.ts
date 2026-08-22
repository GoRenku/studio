import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

describe('Engines config-file boundary', () => {
  it('does not discover platform user configuration', async () => {
    const files = (await listTypeScriptFiles(sourceRoot)).filter(
      (file) => !file.endsWith('.test.ts')
    );
    const offenders: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      const imports = extractImportSources(source);
      if (
        imports.includes('node:os') ||
        /process\.env\.(?:HOME|USERPROFILE|LOCALAPPDATA|XDG_CONFIG_HOME)\b/.test(
          source
        )
      ) {
        offenders.push(path.relative(sourceRoot, file));
      }
    }

    expect(
      offenders,
      'Engines must receive provider secrets from an injected resolver; Core owns user config discovery.'
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
  const pattern =
    /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  return Array.from(source.matchAll(pattern), (match) =>
    String(match[1] ?? match[2] ?? match[3])
  );
}
