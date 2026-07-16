import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const studioSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const uiSourceRoot = path.join(studioSourceRoot, 'ui');
const mediaCardSourceRoot = path.join(uiSourceRoot, 'media-card');

interface ForbiddenSourcePattern {
  label: string;
  pattern: RegExp;
  reason: string;
}

interface ArchitectureFinding {
  file: string;
  line?: number;
  importSource?: string;
  pattern: string;
  reason: string;
}

const featureForbiddenImports: ForbiddenSourcePattern[] = [
  {
    label: 'server-only core import',
    pattern: /^@gorenku\/studio-core\/server(?:\/|$)/,
    reason:
      'browser feature code must consume browser-safe contracts and Studio HTTP services, not server-only core APIs',
  },
  {
    label: 'Node filesystem import',
    pattern: /^node:fs(?:\/|$)/,
    reason: 'browser feature code must not import Node filesystem APIs',
  },
  {
    label: 'Node path import',
    pattern: /^node:path$/,
    reason: 'browser feature code must not import Node path APIs',
  },
  {
    label: 'SQLite driver import',
    pattern: /^better-sqlite3$/,
    reason: 'browser feature code must not import database drivers',
  },
  {
    label: 'Drizzle import',
    pattern: /^drizzle-orm(?:\/|$)/,
    reason: 'browser feature code must not import Drizzle/database modules',
  },
];

const rawControlPatterns = [
  {
    pattern: /<button\b/,
    label: '<button',
    reason: 'feature code must use the local Button primitive from src/ui',
  },
  {
    pattern: /<input\b/,
    label: '<input',
    reason: 'feature code must use the local Input primitive from src/ui',
  },
  {
    pattern: /<select\b/,
    label: '<select',
    reason: 'feature code must use the local Select primitive from src/ui',
  },
  {
    pattern: /<textarea\b/,
    label: '<textarea',
    reason: 'feature code must use the local Textarea primitive from src/ui',
  },
  {
    pattern: /<dialog\b/,
    label: '<dialog',
    reason: 'feature code must use the local Dialog primitive from src/ui',
  },
];

const mediaCardForbiddenImports: ForbiddenSourcePattern[] = [
  {
    label: 'feature import',
    pattern: /^@\/features(?:\/|$)/,
    reason: 'the shared media-card UI module must not depend on feature domains',
  },
  {
    label: 'service import',
    pattern: /^@\/services(?:\/|$)/,
    reason: 'the shared media-card UI module must not call Studio services',
  },
  {
    label: 'server import',
    pattern: /^@\/server(?:\/|$)|^@gorenku\/studio-core\/server(?:\/|$)/,
    reason: 'the shared media-card UI module must remain browser-only',
  },
  {
    label: 'Core domain import',
    pattern: /^@gorenku\/studio-core(?:\/|$)/,
    reason: 'the shared media-card UI module must remain domain-neutral',
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
    const findings = await findForbiddenImports(
      files,
      featureForbiddenImports
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
            pattern: rawControlPattern.label,
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

  it('keeps the shared media-card module independent of feature and service domains', async () => {
    const files = (await listTypeScriptFiles(mediaCardSourceRoot)).filter(
      (file) => !isTestFile(file)
    );

    expect(
      await findForbiddenImports(files, mediaCardForbiddenImports),
      [
        'The media-card module owns bounded visual-card presentation only.',
        'Feature behavior, Studio services, server code, and Core domain contracts must stay outside it.',
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

async function findForbiddenImports(
  files: string[],
  forbiddenImports: ForbiddenSourcePattern[]
): Promise<ArchitectureFinding[]> {
  const findings = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf8');
      return extractImportSources(source).flatMap((importSource) => {
        const forbiddenImport = forbiddenImports.find((candidate) =>
          candidate.pattern.test(importSource)
        );
        return forbiddenImport
          ? [
              {
                file: relativeSourcePath(file),
                importSource,
                pattern: forbiddenImport.label,
                reason: forbiddenImport.reason,
              },
            ]
          : [];
      });
    })
  );
  return findings.flat();
}

function findPatternLines(source: string, pattern: RegExp): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

function extractImportSources(source: string): string[] {
  const importSourcePattern =
    /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  const importSources: string[] = [];
  for (const match of source.matchAll(importSourcePattern)) {
    const importSource = match[1] ?? match[2] ?? match[3];
    if (importSource) {
      importSources.push(importSource);
    }
  }
  return importSources;
}

function isTestFile(file: string): boolean {
  return (
    file.endsWith('.test.ts') ||
    file.endsWith('.test.tsx') ||
    file.endsWith('.e2e.test.ts') ||
    file.endsWith('.e2e.test.tsx') ||
    file.endsWith('.test-fixture.ts') ||
    file.endsWith('.test-fixture.tsx')
  );
}

function isWithin(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
