import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  listMediaGenerationPurposeDefinitions,
} from './media-generation/lifecycle/purpose-lifecycle-registry.js';
import {
  listMediaGenerationPurposeCostDefinitions,
} from './media-generation/cost/purpose-cost-registry.js';

const projectSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const coreSourceRoot = path.join(projectSourceRoot, '..');
const repoRoot = path.resolve(coreSourceRoot, '..', '..', '..');
const clientSourceRoot = path.join(coreSourceRoot, 'client');
const mediaGenerationCostRoot = path.join(
  projectSourceRoot,
  'media-generation',
  'cost'
);
const shotVideoTakePurposeRoot = path.join(
  projectSourceRoot,
  'media-generation',
  'purposes',
  'shot-video-take'
);
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
    const forbiddenImports = forbiddenInfrastructureImports(source);
    const directDatabaseAccessLines = findPatternLines(source, /\bsession\s*\.\s*db\b/);

    expect(lineCount).toBeLessThanOrEqual(80);
    expect(forbiddenImports).toEqual([]);
    expect(directDatabaseAccessLines).toEqual([]);
    expect(source).not.toMatch(
      /from ['"]\.\/(?:commands|database|files|production-export|resources|schema)\//
    );
    expect(source).not.toMatch(
      /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]\.\/project-data-service-contracts\.js['"]/m
    );
  });

  it('keeps ProjectDataService domain wiring shallow', async () => {
    const files = await listTypeScriptFiles(projectDataServiceWiringRoot);

    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      expect(source.split('\n').length).toBeLessThanOrEqual(100);
      expect(forbiddenInfrastructureImports(source)).toEqual([]);
      expect(findPatternLines(source, /\bsession\s*\.\s*db\b/)).toEqual([]);
      expect(source).not.toMatch(/from ['"]\.\.\/(?:files|schema)\//);
    }
  });

  it('does not expose generic shot video take state patching through ProjectDataService', async () => {
    const source = await fs.readFile(
      path.join(projectSourceRoot, 'project-data-service-contracts.ts'),
      'utf8'
    );
    const forbiddenPatterns = [
      {
        pattern: /\bSceneShotVideoTakeState\b/,
        label: 'durable take state type',
        reason:
          'adapter-facing contracts must expose focused take commands instead of durable take-state shapes',
      },
      {
        pattern: /\bstatePatch\b/,
        label: 'state patch payload',
        reason:
          'callers must not be able to construct arbitrary durable take-state maps',
      },
      {
        pattern: /\bPartial\s*<\s*SceneShotVideoTakeState\s*>/,
        label: 'partial durable take state',
        reason:
          'generic take-state patch input must not be part of the public service contract',
      },
    ];
    const offenders = forbiddenPatterns.flatMap(({ pattern, label, reason }) =>
      findPatternLines(source, pattern).map((line) => ({
        file: 'project-data-service-contracts.ts',
        line,
        pattern: label,
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
        relativePath.startsWith(
          path.join('media-generation', 'purposes', 'shot-video-take')
        )
      ) {
        continue;
      }
      const source = await fs.readFile(file, 'utf8');
      if (
        extractImportSources(source).some((importSource) =>
          importSource.endsWith('/database/access/scene-shot-video-takes.js')
        )
      ) {
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

  it('keeps generic image edit generation out of destination media mutation modules', async () => {
    const imageEditSource = await fs.readFile(
      path.join(
        projectSourceRoot,
        'media-generation',
        'purposes',
        'image-edit.ts'
      ),
      'utf8'
    );
    const forbiddenDestinationImports = extractImportSources(imageEditSource)
      .filter((importSource) =>
        [
          'media-generation/purposes/shot-video-take',
          'media-generation/purposes/cast',
          'media-generation/purposes/location',
          'media-generation/purposes/lookbook',
          'media-generation/purposes/scene',
        ].some((destinationPath) => importSource.includes(destinationPath))
      );

    expect(
      forbiddenDestinationImports,
      [
        '`image.edit` may create generated files and run records only.',
        'Destination attachment and replacement must remain in purpose-owned import commands.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps runtime project data access off direct SQLite prepare calls', async () => {
    const files = await listTypeScriptFiles(projectSourceRoot);
    const runtimeFiles = files.filter(
      (file) =>
        !file.endsWith('.test.ts') &&
        path.relative(projectSourceRoot, file) !==
          path.join('database', 'lifecycle', 'store.ts')
    );
    const directSQLitePreparePattern = /\bsession\s*\.\s*sqlite\s*\.\s*prepare\b/;
    const offenders: string[] = [];

    for (const file of runtimeFiles) {
      const source = await fs.readFile(file, 'utf8');
      if (directSQLitePreparePattern.test(source)) {
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
      path.join('media-generation', 'purposes', 'scene-dialogue-audio.ts'),
    ]);
    const offenders: Array<{ file: string; pattern: string }> = [];

    for (const file of files) {
      const relativePath = path.relative(projectSourceRoot, file);
      const source = await fs.readFile(file, 'utf8');
      const forbiddenPatterns = ['.delete('];
      if (!transientCleanupFiles.has(relativePath)) {
        forbiddenPatterns.push('fs.rm(', 'fs.unlink(');
      }
      forbiddenPatterns.forEach((pattern) => {
        if (source.includes(pattern)) {
          offenders.push({ file: relativePath, pattern });
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

  it('keeps video prompt sheet internals out of runtime contracts', async () => {
    const roots = [
      path.join(repoRoot, 'packages', 'core', 'src'),
      path.join(repoRoot, 'packages', 'cli', 'src'),
      path.join(repoRoot, 'packages', 'studio', 'src'),
      path.join(repoRoot, 'packages', 'studio', 'server'),
    ];
    const files = (await Promise.all(roots.map(listSourceFiles))).flat();
    const forbiddenMarkers = [
      'VideoPrompt' + 'ImageStyleId',
      'VideoPrompt' + 'AnnotationKey',
      'VideoPrompt' + 'ImagePlan',
      'VideoPrompt' + 'Panel',
      'videoPrompt' + 'ImagePlan',
      'CORE_VIDEO_PROMPT' + '_IMAGE',
    ];
    const offenders: Array<{ file: string; line: number; pattern: string }> = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      for (const marker of forbiddenMarkers) {
        findTextLines(source, marker).forEach((line) => {
          offenders.push({
            file: path.relative(repoRoot, file),
            line,
            pattern: marker,
          });
        });
      }
    }

    expect(
      offenders,
      [
        'Video prompt sheets are opaque image artifacts.',
        'Runtime contracts may keep promptSheetVisualStyleId and promptSheetNotationModeId,',
        'but must not reintroduce panel plans, annotation keys, or content-plan validation.',
      ].join(' ')
    ).toEqual([]);
  });

  it('requires explicit cost projection on every media generation purpose', async () => {
    const definitionsMissingProjection = listMediaGenerationPurposeDefinitions()
      .filter((definition) => typeof definition.buildCostProjection !== 'function')
      .map((definition) => definition.purpose);

    expect(definitionsMissingProjection).toEqual([]);
  });

  it('keeps cost and lifecycle purpose registries aligned by public purpose id', async () => {
    const lifecyclePurposes = listMediaGenerationPurposeDefinitions()
      .map((definition) => definition.purpose)
      .sort();
    const costPurposes = listMediaGenerationPurposeCostDefinitions()
      .map((definition) => definition.purpose)
      .sort();

    expect(costPurposes).toEqual(lifecyclePurposes);
  });

  it('keeps media generation cost independent from readiness and execution modules', async () => {
    const files = (await listTypeScriptFiles(mediaGenerationCostRoot)).filter(
      (file) => !file.endsWith('.test.ts')
    );
    const offenders: Array<{ file: string; importSource: string; reason: string }> =
      [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      for (const importSource of extractImportSources(source)) {
        const reason = forbiddenMediaGenerationCostImportReason(importSource);
        if (reason) {
          offenders.push({
            file: path.relative(projectSourceRoot, file),
            importSource,
            reason,
          });
        }
      }
    }

    expect(
      offenders,
      [
        'Core media generation cost must stay a pricing projection module.',
        'It may map specs to pricing inputs and call engine pricing,',
        'but it must not import lifecycle readiness, provider preparation, dependency selection, run, import, database, filesystem, or Shot Video Take planning modules.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps Shot Video Take submodule imports directed by owner', async () => {
    const files = (await listTypeScriptFiles(shotVideoTakePurposeRoot)).filter(
      (file) => !file.endsWith('.test.ts')
    );
    const offenders: Array<{
      file: string;
      importSource: string;
      reason: string;
    }> = [];

    for (const file of files) {
      const sourceOwner = path
        .relative(shotVideoTakePurposeRoot, file)
        .split(path.sep)[0];
      const source = await fs.readFile(file, 'utf8');
      for (const importSource of extractImportSources(source)) {
        const resolvedPath = await resolveImportSourcePath(file, importSource);
        const reason = forbiddenShotVideoTakeSubmoduleImportReason({
          importSource,
          sourceOwner,
          targetPath: resolvedPath,
        });
        if (reason) {
          offenders.push({
            file: path.relative(projectSourceRoot, file),
            importSource,
            reason,
          });
        }
      }
    }

    expect(
      offenders,
      [
        'Shot Video Take submodules must preserve their module boundaries.',
        'Planning cannot import provider, run, import, or persistence writers;',
        'selection cannot import provider, run, or import modules;',
        'provider cannot import selection mutations or persistence writers;',
        'imports cannot import provider or run modules;',
        'and persistence cannot import provider, run, import, or engine execution/pricing modules.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps media generation live cost approval fail-fast', async () => {
    const runtimeRoots = [
      path.join(repoRoot, 'packages', 'core', 'src'),
      path.join(repoRoot, 'packages', 'cli', 'src'),
      path.join(repoRoot, 'packages', 'studio', 'src'),
      path.join(repoRoot, 'packages', 'studio', 'server'),
      path.join(repoRoot, 'packages', 'engines', 'src'),
    ];
    const runtimeFiles = (await Promise.all(runtimeRoots.map(listSourceFiles)))
      .flat()
      .filter(
        (file) =>
          !file.endsWith('.test.ts') &&
          !file.endsWith('.test.tsx') &&
          path.relative(repoRoot, file) !==
            path.join('packages', 'core', 'src', 'server', 'architecture.test.ts')
      );
    const forbiddenPatterns = [
      {
        label: 'obsolete unpriced approval sentinel',
        pattern: /unpriced-cost-override/,
      },
      {
        label: 'obsolete unpriced approval flag',
        pattern: /\ballowUnpricedCost\b/,
      },
      {
        label: 'run path self-approval from fresh estimate',
        pattern: /approvalToken\s*:\s*estimate\.costApprovalToken/,
      },
    ];
    const offenders: Array<{ file: string; line: number; pattern: string }> = [];

    for (const file of runtimeFiles) {
      const source = await fs.readFile(file, 'utf8');
      for (const forbiddenPattern of forbiddenPatterns) {
        findPatternLines(source, forbiddenPattern.pattern).forEach((line) => {
          offenders.push({
            file: path.relative(repoRoot, file),
            line,
            pattern: forbiddenPattern.label,
          });
        });
      }
    }

    const engineRunnerSource = await fs.readFile(
      path.join(
        repoRoot,
        'packages',
        'engines',
        'src',
        'generation',
        'execution',
        'runner.ts'
      ),
      'utf8'
    );
    for (const forbiddenPattern of [
      {
        label: 'run approval token option',
        pattern: /\bapprovalToken\??\s*:\s*string\b/,
      },
      {
        label: 'obsolete unpriced approval option',
        pattern: /\ballowUnpricedCost\??\s*:\s*boolean\b/,
      },
      {
        label: 'engine-side approval type',
        pattern: /\bGenerationRunCostApproval\b/,
      },
      {
        label: 'engine-side approval option',
        pattern: /\bcostApproval\b/,
      },
    ]) {
      findPatternLines(engineRunnerSource, forbiddenPattern.pattern).forEach((line) => {
        offenders.push({
          file: path.join(
            'packages',
            'engines',
            'src',
            'generation',
            'execution',
            'runner.ts'
          ),
          line,
          pattern: forbiddenPattern.label,
        });
      });
    }

    const dependencyContractSource = await fs.readFile(
      path.join(
        repoRoot,
        'packages',
        'core',
        'src',
        'client',
        'media-generation-dependency.ts'
      ),
      'utf8'
    );
    findPatternLines(dependencyContractSource, /\bcostApprovalToken\b/).forEach(
      (line) => {
        offenders.push({
          file: path.join(
            'packages',
            'core',
            'src',
            'client',
            'media-generation-dependency.ts'
          ),
          line,
          pattern: 'dependency approval token field',
        });
      }
    );

    expect(
      offenders,
      [
        'Live media generation approval must be explicit caller intent.',
        'Core run paths must use the shared cost-approval gate and engines must not receive approval tokens.',
        'Dependency plans must not expose approval tokens.',
        'Do not reintroduce sentinel strings, old unpriced flags, computed estimate tokens as run approval, or engine-side approval matching.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps command modules away from low-level asset file accessors', async () => {
    const files = (await listTypeScriptFiles(path.join(projectSourceRoot, 'commands')))
      .filter((file) => !file.endsWith('.test.ts'));
    const assetFileAccessPath = path.join(
      projectSourceRoot,
      'database',
      'access',
      'asset-files.ts'
    );
    const offenders: Array<{ file: string; importSource: string }> = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      for (const importSource of extractImportSources(source)) {
        const resolvedImportPath = await resolveImportSourcePath(file, importSource);
        if (resolvedImportPath === assetFileAccessPath) {
          offenders.push({
            file: path.relative(projectSourceRoot, file),
            importSource,
          });
        }
      }
    }

    expect(
      offenders,
      [
        'Durable asset-file row writes belong to server/project-asset-files.',
        'Command modules should express owner intent through the storage module instead of importing low-level asset-file accessors.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps durable filesystem copy operations inside project asset file storage', async () => {
    const roots = [
      path.join(projectSourceRoot, 'commands'),
      path.join(projectSourceRoot, 'media-generation'),
    ];
    const files = (await Promise.all(roots.map(listTypeScriptFiles)))
      .flat()
      .filter((file) => !file.endsWith('.test.ts'));
    const offenders: Array<{ file: string; line: number; pattern: string }> = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      for (const forbiddenPattern of [
        { label: 'fs.copyFile', pattern: /\bfs\s*\.\s*copyFile\s*\(/ },
        { label: 'copyFileSync', pattern: /\bcopyFileSync\s*\(/ },
      ]) {
        findPatternLines(source, forbiddenPattern.pattern).forEach((line) => {
          offenders.push({
            file: path.relative(projectSourceRoot, file),
            line,
            pattern: forbiddenPattern.label,
          });
        });
      }
    }

    expect(
      offenders,
      [
        'Durable file copy materialization belongs in server/project-asset-files.',
        'Purpose and command modules may validate or read source files, but should not copy durable asset bytes themselves.',
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

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(absolutePath);
      }
      return entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
        ? [absolutePath]
        : [];
    })
  );
  return files.flat();
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

function forbiddenInfrastructureImports(source: string): string[] {
  return extractImportSources(source).filter(
    (importSource) =>
      importSource === 'node:fs' ||
      importSource === 'node:path' ||
      importSource.includes('database/access') ||
      importSource.includes('database/lifecycle/store')
  );
}

async function resolveImportSourcePath(
  fromFile: string,
  importSource: string
): Promise<string | null> {
  if (!importSource.startsWith('.')) {
    return null;
  }
  const resolved = path.resolve(path.dirname(fromFile), importSource);
  const candidates = importPathCandidates(resolved);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function importPathCandidates(resolvedPath: string): string[] {
  if (resolvedPath.endsWith('.js')) {
    return [resolvedPath.replace(/\.js$/, '.ts')];
  }
  if (resolvedPath.endsWith('.ts')) {
    return [resolvedPath];
  }
  return [`${resolvedPath}.ts`, path.join(resolvedPath, 'index.ts')];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function forbiddenShotVideoTakeSubmoduleImportReason(input: {
  importSource: string;
  sourceOwner: string;
  targetPath: string | null;
}): string | null {
  if (
    input.sourceOwner === 'persistence' &&
    (input.importSource === '@gorenku/studio-engines' ||
      input.importSource.startsWith('@gorenku/studio-engines/'))
  ) {
    return 'persistence must not import engine execution or pricing modules';
  }
  if (!input.targetPath?.startsWith(shotVideoTakePurposeRoot)) {
    return null;
  }

  const targetRelativePath = path.relative(
    shotVideoTakePurposeRoot,
    input.targetPath
  );
  const targetOwner = targetRelativePath.split(path.sep)[0];

  if (
    input.sourceOwner === 'planning' &&
    ['provider', 'runs', 'imports', 'persistence'].includes(targetOwner)
  ) {
    return 'planning must not import provider, runs, imports, or persistence modules';
  }
  if (
    input.sourceOwner === 'selection' &&
    ['provider', 'runs', 'imports'].includes(targetOwner)
  ) {
    return 'selection must not import provider, runs, or imports modules';
  }
  if (
    input.sourceOwner === 'provider' &&
    targetOwner === 'selection' &&
    targetRelativePath.split(path.sep)[1] === 'mutations'
  ) {
    return 'provider must not import selection mutation modules';
  }
  if (input.sourceOwner === 'provider' && targetOwner === 'persistence') {
    return 'provider must not import persistence write modules';
  }
  if (
    input.sourceOwner === 'imports' &&
    ['provider', 'runs'].includes(targetOwner)
  ) {
    return 'imports must not import provider or runs modules';
  }
  if (
    input.sourceOwner === 'persistence' &&
    ['provider', 'runs', 'imports'].includes(targetOwner)
  ) {
    return 'persistence must not import provider, runs, or imports modules';
  }
  return null;
}

function forbiddenMediaGenerationCostImportReason(
  importSource: string
): string | null {
  if (importSource.startsWith('../lifecycle')) {
    return 'cost must not import media generation lifecycle readiness services';
  }
  if (importSource.startsWith('../purposes')) {
    return 'cost must not import purpose readiness or provider modules';
  }
  if (importSource.includes('dependency-selectors')) {
    return 'cost must not resolve concrete dependency assets';
  }
  if (importSource.includes('provider-payload')) {
    return 'cost must not build or validate provider payloads';
  }
  if (importSource.includes('generation-runs')) {
    return 'cost must not import generation run modules';
  }
  if (importSource.includes('media-imports')) {
    return 'cost must not import media import modules';
  }
  if (importSource.includes('database/access')) {
    return 'cost must not import low-level database access';
  }
  if (
    importSource === 'node:fs' ||
    importSource === 'node:fs/promises' ||
    importSource === 'node:path'
  ) {
    return 'cost must not read or resolve provider input/output files';
  }
  return null;
}

function findTextLines(source: string, text: string): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (line.includes(text) ? [index + 1] : []));
}

function findPatternLines(source: string, pattern: RegExp): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
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
