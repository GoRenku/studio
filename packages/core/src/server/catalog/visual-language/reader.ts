import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
} from '@gorenku/studio-diagnostics';
import type {
  ReadVisualLanguageCatalogEntryInput,
  ReadVisualLanguageCatalogInput,
  VisualLanguageCatalog,
  VisualLanguageCatalogEntry,
} from '../../../client/index.js';
import { ensureVisualLanguageCatalogRoot } from './paths.js';
import { VisualLanguageCatalogError } from './errors.js';
import type { CatalogReadContext } from './contracts.js';
import {
  findExplanationFiles,
  readRequiredCatalogFile,
  resolveCatalogEntryPath,
  toCatalogRelativePath,
} from './file-resolution.js';
import {
  parseCatalogFrontmatter,
  readExplanationFrontmatter,
} from './frontmatter.js';

export async function readVisualLanguageCatalog(
  input: ReadVisualLanguageCatalogInput = {}
): Promise<VisualLanguageCatalog> {
  const catalogRoot = await ensureVisualLanguageCatalogRoot(input);
  const context: CatalogReadContext = { catalogRoot, issues: [] };
  const explanationPaths = await findExplanationFiles(catalogRoot);
  const entries = (
    await Promise.all(
      explanationPaths.map((explanationPath) =>
        readCatalogEntryFromExplanation(context, explanationPath)
      )
    )
  ).filter((entry): entry is VisualLanguageCatalogEntry => entry !== null);

  const seenIds = new Set<string>();
  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      context.issues.push(
        createDiagnosticError(
          'VISUAL_LANGUAGE_CATALOG010',
          `Catalog entry id ${entry.id} appears more than once.`,
          { path: [entry.id], context: 'visual language catalog' },
          'Use a unique stable id for each catalog entry.'
        )
      );
    }
    seenIds.add(entry.id);
  }

  const result = buildDiagnosticResult(context.issues);
  throwIfDiagnosticResultInvalid(result, {
    code: 'VISUAL_LANGUAGE_CATALOG999',
    message: 'Visual language catalog failed validation.',
    suggestion: 'Fix the reported catalog errors and try again.',
  });

  return {
    catalogRoot,
    entries: entries.sort((left, right) => left.id.localeCompare(right.id)),
    warnings: result.warnings,
  };
}

export async function readVisualLanguageCatalogEntry(
  input: ReadVisualLanguageCatalogEntryInput
): Promise<VisualLanguageCatalogEntry> {
  const catalog = await readVisualLanguageCatalog(input);
  const entry = catalog.entries.find((candidate) => candidate.id === input.id);
  if (!entry) {
    throw new VisualLanguageCatalogError(
      'VISUAL_LANGUAGE_CATALOG011',
      `Visual language catalog entry ${input.id} was not found.`,
      {
        suggestion:
          'List the catalog entries and use one of the returned stable entry ids.',
      }
    );
  }
  return entry;
}

async function readCatalogEntryFromExplanation(
  context: CatalogReadContext,
  explanationPath: string
): Promise<VisualLanguageCatalogEntry | null> {
  const entryDir = path.dirname(explanationPath);
  const catalogPath = toCatalogRelativePath(context.catalogRoot, explanationPath);
  const { frontmatter, body } = parseCatalogFrontmatter(
    await fs.readFile(explanationPath, 'utf8'),
    context,
    catalogPath
  );
  if (!frontmatter) {
    return null;
  }

  const metadata = readExplanationFrontmatter(context, frontmatter, catalogPath);
  if (!metadata) {
    return null;
  }

  const promptTemplatePath = resolveCatalogEntryPath(context, {
    entryDir,
    relativePath: metadata.promptTemplate,
    sourcePath: catalogPath,
    field: 'promptTemplate',
  });
  const illustrationPath = resolveCatalogEntryPath(context, {
    entryDir,
    relativePath: metadata.illustration.catalogRelativePath,
    sourcePath: catalogPath,
    field: 'illustration.file',
  });
  if (!promptTemplatePath || !illustrationPath) {
    return null;
  }

  const promptTemplateMarkdown = await readRequiredCatalogFile(context, {
    filePath: promptTemplatePath,
    sourcePath: catalogPath,
    field: 'promptTemplate',
  });
  await readRequiredCatalogFile(context, {
    filePath: illustrationPath,
    sourcePath: catalogPath,
    field: 'illustration.file',
  });
  if (promptTemplateMarkdown === null) {
    return null;
  }

  return {
    id: metadata.id,
    category: metadata.category,
    name: metadata.name,
    summary: metadata.summary,
    explanationMarkdown: body.trim(),
    promptTemplateMarkdown: promptTemplateMarkdown.trim(),
    illustration: {
      catalogRelativePath: toCatalogRelativePath(context.catalogRoot, illustrationPath),
      mediaKind: metadata.illustration.mediaKind,
    },
    tags: metadata.tags,
    appliesTo: metadata.appliesTo,
    difficulty: metadata.difficulty,
  };
}
