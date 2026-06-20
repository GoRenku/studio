import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const coreSourceRoot = path.join(projectSourceRoot, '..');
const clientSourceRoot = path.join(coreSourceRoot, 'client');
const projectDataServiceWiringRoot = path.join(
  projectSourceRoot,
  'project-data-service-wiring'
);

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
      path.join(clientSourceRoot, 'media-generation.ts'),
      path.join(clientSourceRoot, 'media-generation', 'index.ts'),
      path.join(projectSourceRoot, 'media-generation', 'shot-video-take.ts'),
      path.join(projectSourceRoot, 'media-generation', 'shot-video-take', 'index.ts'),
      path.join(projectSourceRoot, 'media-generation', 'shot-video-take', 'internal-runtime.ts'),
      path.join(projectSourceRoot, '..', 'node'),
      path.join(coreSourceRoot, 'index.ts'),
      path.join(coreSourceRoot, 'index.test.ts'),
    ];

    for (const removedPath of removedPaths) {
      await expect(fs.access(removedPath)).rejects.toThrow();
    }
  });

  it('keeps ProjectDataService as a small facade over explicit domain wiring', async () => {
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

    expect(lineCount).toBeLessThanOrEqual(80);
    expect(
      forbiddenNeedles.filter((needle) => source.includes(needle))
    ).toEqual([]);
    expect(source).not.toMatch(
      /from ['"]\.\/(?:commands|database|files|production-export|resources|schema)\//
    );
    expect(source).not.toMatch(
      /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]\.\/project-data-service-contracts\.js['"]/m
    );
  });

  it('keeps ProjectDataService domain wiring shallow', async () => {
    const files = await listTypeScriptFiles(projectDataServiceWiringRoot);
    const forbiddenNeedles = [
      'node:fs',
      'node:path',
      'database/access',
      'session.db',
      'openProjectStore',
    ];

    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      expect(source.split('\n').length).toBeLessThanOrEqual(100);
      expect(
        forbiddenNeedles.filter((needle) => source.includes(needle))
      ).toEqual([]);
      expect(source).not.toMatch(/from ['"]\.\.\/(?:files|schema)\//);
    }
  });

  it('does not expose generic shot video take state patching through ProjectDataService', async () => {
    const source = await fs.readFile(
      path.join(projectSourceRoot, 'project-data-service-contracts.ts'),
      'utf8'
    );
    const forbiddenNeedles = [
      {
        needle: 'updateSceneShotVideoTakeState',
        reason:
          'adapter-facing contracts must expose focused take commands instead of a generic metadata patch method',
      },
      {
        needle: 'UpdateSceneShotVideoTakeStateInput',
        reason:
          'generic take-state patch input must not be part of the public service contract',
      },
      {
        needle: 'statePatch: Partial<SceneShotVideoTakeState>',
        reason:
          'callers must not be able to construct arbitrary durable take-state maps',
      },
    ];
    const offenders = forbiddenNeedles.flatMap(({ needle, reason }) =>
      findNeedleLines(source, needle).map((line) => ({
        file: 'project-data-service-contracts.ts',
        line,
        needle,
        reason,
      }))
    );

    expect(
      offenders,
      [
        'ProjectDataService is the adapter-facing core contract for Studio server and CLI.',
        'It must not expose generic shot video take state patching as a metadata escape hatch.',
        'Resolve this during 0077 by adding focused core commands that validate ownership, scene membership, and dependency scope before writing durable take state.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps low-level take-state writers inside core-owned command modules', async () => {
    const files = await listTypeScriptFiles(projectSourceRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const relativePath = path.relative(projectSourceRoot, file);
      if (
        relativePath === 'architecture.test.ts' ||
        relativePath.endsWith('.test.ts') ||
        relativePath === path.join('database', 'access', 'scene-shot-video-takes.ts') ||
        relativePath.startsWith(path.join('media-generation', 'shot-video-take'))
      ) {
        continue;
      }
      const source = await fs.readFile(file, 'utf8');
      if (source.includes('updateSceneShotVideoTakeStateRecord')) {
        offenders.push(relativePath);
      }
    }

    expect(
      offenders,
      [
        'Durable take-state map writes must stay behind focused core commands.',
        'Adapters and broad wiring modules must not import the low-level state writer directly.',
      ].join(' ')
    ).toEqual([]);
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

  it('keeps callers away from deleted media generation module paths', async () => {
    const files = await listTypeScriptFiles(coreSourceRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      const relativePath = path.relative(coreSourceRoot, file);
      if (relativePath === path.join('server', 'architecture.test.ts')) {
        continue;
      }
      const deletedClientPath = ['media-generation', 'js'].join('.');
      const importsDeletedClientPath =
        source.includes(`from '../client/${deletedClientPath}'`) ||
        source.includes(`from "../client/${deletedClientPath}"`) ||
        source.includes(`from '../../client/${deletedClientPath}'`) ||
        source.includes(`from "../../client/${deletedClientPath}"`) ||
        source.includes(`import('./${deletedClientPath}')`) ||
        source.includes(`import("./${deletedClientPath}")`);

      if (importsDeletedClientPath) {
        offenders.push(relativePath);
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

  it('keeps client contract modules as real owners, not re-export stubs', async () => {
    const files = (await listTypeScriptFiles(clientSourceRoot)).filter(
      (file) => path.basename(file) !== 'index.ts' && !file.endsWith('.test.ts')
    );
    const offenders: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      const significantLines = source
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'));
      const ownsExport = significantLines.some(isOwningExportLine);
      const onlyReExports = significantLines.every(
        (line) => line.startsWith('export ') && line.includes(' from ')
      );

      if (!ownsExport || onlyReExports) {
        offenders.push(path.relative(clientSourceRoot, file));
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
        relativePath.startsWith(path.join('database', 'lifecycle')) ||
        relativePath.startsWith(`trash${path.sep}`)
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

  it('keeps recoverable deletion flows behind the trash lifecycle service', async () => {
    const files = [
      ...(await listTypeScriptFiles(path.join(projectSourceRoot, 'commands'))),
      ...(await listTypeScriptFiles(path.join(projectSourceRoot, 'media-generation'))),
    ].filter((file) => !file.endsWith('.test.ts'));
    const transientCleanupFiles = new Set([
      path.join('commands', 'cast-voice-commands.ts'),
      path.join('media-generation', 'scene-dialogue-audio.ts'),
    ]);
    const offenders: Array<{ file: string; needle: string }> = [];

    for (const file of files) {
      const relativePath = path.relative(projectSourceRoot, file);
      const source = await fs.readFile(file, 'utf8');
      const forbiddenNeedles = ['.delete(', 'deleteProjectRelativeFile'];
      if (!transientCleanupFiles.has(relativePath)) {
        forbiddenNeedles.push('fs.rm(', 'fs.unlink(');
      }
      forbiddenNeedles.forEach((needle) => {
        if (source.includes(needle)) {
          offenders.push({ file: relativePath, needle });
        }
      });
    }

    expect(
      offenders,
      [
        'Recoverable user-facing deletions must call the trash lifecycle service.',
        'Do not hard-delete rows, unlink files, or route around the core trash registry from command/media modules.',
      ].join(' ')
    ).toEqual([]);
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

function findNeedleLines(source: string, needle: string): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (line.includes(needle) ? [index + 1] : []));
}

function isOwningExportLine(line: string): boolean {
  return (
    line.startsWith('export interface ') ||
    line.startsWith('export type ') ||
    line.startsWith('export const ') ||
    line.startsWith('export function ') ||
    line.startsWith('export async function ') ||
    line.startsWith('export class ') ||
    line.startsWith('export enum ')
  );
}
