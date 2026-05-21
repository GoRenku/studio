import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const coreSourceRoot = path.join(projectSourceRoot, '..');
const clientSourceRoot = path.join(coreSourceRoot, 'client');

describe('core server architecture', () => {
  it('does not revive transitional resource or node modules', async () => {
    const removedPaths = [
      path.join(projectSourceRoot, 'project-data-service.test.ts'),
      path.join(projectSourceRoot, 'project-data-service-tests'),
      path.join(projectSourceRoot, 'test-support'),
      path.join(projectSourceRoot, 'setup'),
      path.join(projectSourceRoot, 'setup', 'validation.ts'),
      path.join(projectSourceRoot, 'commands', 'update-markdown-asset-content.ts'),
      path.join(projectSourceRoot, 'resources', 'markdown-asset-content.ts'),
      path.join(projectSourceRoot, 'database', 'access', 'markdown-asset-content.ts'),
      path.join(projectSourceRoot, 'database', 'access', 'rich-text-asset-links.ts'),
      path.join(projectSourceRoot, 'files', 'markdown-asset-files.ts'),
      path.join(projectSourceRoot, 'project-resource-queries.ts'),
      path.join(projectSourceRoot, 'resources', 'project-read-operations.ts'),
      path.join(projectSourceRoot, 'resources', 'project-resource-operations.ts'),
      path.join(projectSourceRoot, 'resources', 'cursors.ts'),
      path.join(projectSourceRoot, '..', 'node'),
      path.join(coreSourceRoot, 'index.ts'),
      path.join(coreSourceRoot, 'index.test.ts'),
    ];

    for (const removedPath of removedPaths) {
      await expect(fs.access(removedPath)).rejects.toThrow();
    }
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
    ];

    expect(lineCount).toBeLessThanOrEqual(140);
    expect(
      forbiddenNeedles.filter((needle) => source.includes(needle))
    ).toEqual([]);
    expect(source).not.toMatch(
      /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]\.\/project-data-service-contracts\.js['"]/m
    );
  });

  it('keeps re-export facades limited to index files', async () => {
    const files = await listTypeScriptFiles(coreSourceRoot);
    const offenders: string[] = [];
    const reExportPattern =
      /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"][^'"]+['"]/m;

    for (const file of files) {
      if (path.basename(file) === 'index.ts') {
        continue;
      }

      const source = await fs.readFile(file, 'utf8');
      if (reExportPattern.test(source)) {
        offenders.push(path.relative(coreSourceRoot, file));
      }
    }

    expect(offenders).toEqual([]);
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

  it('keeps client domain contract files as real owners, not re-export stubs', async () => {
    const domainFiles = [
      'assets.ts',
      'cast-members.ts',
      'diagnostics.ts',
      'screenplay.ts',
      'production-export.ts',
      'project-languages.ts',
      'project-library.ts',
      'project.ts',
      'resources.ts',
      'visual-language.ts',
    ];
    const offenders: string[] = [];

    for (const domainFile of domainFiles) {
      const source = await fs.readFile(path.join(clientSourceRoot, domainFile), 'utf8');
      const significantLines = source
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'));
      const ownsContract =
        significantLines.some((line) => line.startsWith('export interface ')) ||
        significantLines.some((line) => line.startsWith('export type '));
      const onlyReExports = significantLines.every(
        (line) => line.startsWith('export ') && line.includes(' from ')
      );

      if (!ownsContract || onlyReExports) {
        offenders.push(domainFile);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps direct Drizzle schema imports inside database access and schema modules', async () => {
    const files = await listTypeScriptFiles(projectSourceRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const relativePath = path.relative(projectSourceRoot, file);
      if (
        relativePath.startsWith(`schema${path.sep}`) ||
        relativePath.startsWith(path.join('database', 'access')) ||
        relativePath.startsWith(path.join('database', 'lifecycle'))
      ) {
        continue;
      }

      const source = await fs.readFile(file, 'utf8');
      if (source.match(/from ['"].*schema(?:\/index)?\.js['"]/)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not let command modules re-export resource implementations', async () => {
    const commandRoot = path.join(projectSourceRoot, 'commands');
    const files = await listTypeScriptFiles(commandRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      if (source.match(/export\s+(?:\*|\{[^}]*\})\s+from ['"]\.\.\/resources\//)) {
        offenders.push(path.relative(commandRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps command modules from depending on resource readers', async () => {
    const commandRoot = path.join(projectSourceRoot, 'commands');
    const files = await listTypeScriptFiles(commandRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      if (source.match(/from ['"]\.\.\/resources\//)) {
        offenders.push(path.relative(commandRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps raw asset relationship table config inside database access', async () => {
    const files = await listTypeScriptFiles(projectSourceRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const relativePath = path.relative(projectSourceRoot, file);
      if (
        relativePath === 'architecture.test.ts' ||
        relativePath.startsWith(path.join('database', 'access'))
      ) {
        continue;
      }

      const source = await fs.readFile(file, 'utf8');
      if (
        source.includes(
          "from '../database/access/asset-relationships/targets.js'"
        ) ||
        source.includes(
          "from './database/access/asset-relationships/targets.js'"
        ) ||
        source.includes(
          "from '../../database/access/asset-relationships/targets.js'"
        )
      ) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps asset relationship access free of any-casts', async () => {
    const relationshipRoot = path.join(
      projectSourceRoot,
      'database',
      'access',
      'asset-relationships'
    );
    const files = await listTypeScriptFiles(relationshipRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      if (source.includes('as any')) {
        offenders.push(path.relative(relationshipRoot, file));
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
