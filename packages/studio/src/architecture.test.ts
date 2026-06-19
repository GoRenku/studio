import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const studioSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const uiSourceRoot = path.join(studioSourceRoot, 'ui');

interface ForbiddenNeedle {
  needle: string;
  reason: string;
}

interface ArchitectureFinding {
  file: string;
  line: number;
  needle: string;
  reason: string;
}

const featureImportForbiddenNeedles: ForbiddenNeedle[] = [
  {
    needle: '@gorenku/studio-core/server',
    reason:
      'browser feature code must consume browser-safe contracts and Studio HTTP services, not server-only core APIs',
  },
  {
    needle: 'node:fs',
    reason: 'browser feature code must not import Node filesystem APIs',
  },
  {
    needle: 'node:path',
    reason: 'browser feature code must not import Node path APIs',
  },
  {
    needle: 'better-sqlite3',
    reason: 'browser feature code must not import database drivers',
  },
  {
    needle: 'drizzle-orm',
    reason: 'browser feature code must not import Drizzle/database modules',
  },
];

const rawControlPatterns = [
  {
    pattern: /<button\b/,
    needle: '<button',
    reason: 'feature code must use the local Button primitive from src/ui',
  },
  {
    pattern: /<input\b/,
    needle: '<input',
    reason: 'feature code must use the local Input primitive from src/ui',
  },
  {
    pattern: /<select\b/,
    needle: '<select',
    reason: 'feature code must use the local Select primitive from src/ui',
  },
  {
    pattern: /<textarea\b/,
    needle: '<textarea',
    reason: 'feature code must use the local Textarea primitive from src/ui',
  },
  {
    pattern: /<dialog\b/,
    needle: '<dialog',
    reason: 'feature code must use the local Dialog primitive from src/ui',
  },
];

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

  it('keeps server, filesystem, and database imports out of browser feature code', async () => {
    const files = (await listTypeScriptFiles(studioSourceRoot)).filter(
      (file) => !isTestFile(file)
    );
    const findings = await findForbiddenNeedles(
      files,
      featureImportForbiddenNeedles
    );

    expect(
      findings,
      [
        'Studio React code is a browser projection consumer.',
        'It must send user intent to Studio HTTP services and must not import server-only core, Node, or database APIs.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps raw browser controls inside local UI primitives', async () => {
    const files = (await listTypeScriptFiles(studioSourceRoot)).filter(
      (file) =>
        file.endsWith('.tsx') &&
        !isTestFile(file) &&
        !isWithin(file, uiSourceRoot)
    );
    const findings: ArchitectureFinding[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      for (const rawControlPattern of rawControlPatterns) {
        for (const line of findPatternLines(source, rawControlPattern.pattern)) {
          findings.push({
            file: relativeSourcePath(file),
            line,
            needle: rawControlPattern.needle,
            reason: rawControlPattern.reason,
          });
        }
      }
    }

    expect(
      findings,
      [
        'Feature components in packages/studio must use shadcn-style primitives from src/ui.',
        'If a primitive is missing, add it under src/ui first and then consume it from feature code.',
      ].join(' ')
    ).toEqual([]);
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

async function findForbiddenNeedles(
  files: string[],
  forbiddenNeedles: ForbiddenNeedle[]
): Promise<ArchitectureFinding[]> {
  const findings = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf8');
      return forbiddenNeedles.flatMap((forbiddenNeedle) =>
        findNeedleLines(source, forbiddenNeedle.needle).map((line) => ({
          file: relativeSourcePath(file),
          line,
          needle: forbiddenNeedle.needle,
          reason: forbiddenNeedle.reason,
        }))
      );
    })
  );
  return findings.flat();
}

function findNeedleLines(source: string, needle: string): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (line.includes(needle) ? [index + 1] : []));
}

function findPatternLines(source: string, pattern: RegExp): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

function isTestFile(file: string): boolean {
  return (
    file.endsWith('.test.ts') ||
    file.endsWith('.test.tsx') ||
    file.endsWith('.e2e.test.ts') ||
    file.endsWith('.e2e.test.tsx')
  );
}

function isWithin(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
