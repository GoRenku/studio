import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { parse as parseYaml } from 'yaml';
import type {
  ReadVisualLanguageCatalogEntryInput,
  ReadVisualLanguageCatalogInput,
  VisualLanguageCatalog,
  VisualLanguageCatalogDifficulty,
  VisualLanguageCatalogEntry,
  VisualLanguageCatalogIllustration,
} from '../../../client/index.js';
import { ensureVisualLanguageCatalogRoot } from './paths.js';
import { VisualLanguageCatalogError } from './errors.js';

interface CatalogReadContext {
  catalogRoot: string;
  issues: DiagnosticIssue[];
}

interface ExplanationFrontmatter {
  id: string;
  category: string;
  name: string;
  summary: string;
  promptTemplate: string;
  illustration: VisualLanguageCatalogIllustration;
  tags: string[];
  appliesTo: string[];
  difficulty?: VisualLanguageCatalogDifficulty;
}

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

async function findExplanationFiles(catalogRoot: string): Promise<string[]> {
  const paths: string[] = [];
  await walk(catalogRoot, paths);
  return paths.sort();
}

async function walk(directoryPath: string, explanationPaths: string[]): Promise<void> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, explanationPaths);
    } else if (entry.isFile() && entry.name === 'explanation.md') {
      explanationPaths.push(entryPath);
    }
  }
}

async function readCatalogEntryFromExplanation(
  context: CatalogReadContext,
  explanationPath: string
): Promise<VisualLanguageCatalogEntry | null> {
  const entryDir = path.dirname(explanationPath);
  const catalogPath = toCatalogRelativePath(context.catalogRoot, explanationPath);
  const { frontmatter, body } = parseFrontmatter(
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

function parseFrontmatter(
  contents: string,
  context: CatalogReadContext,
  catalogPath: string
): { frontmatter: Record<string, unknown> | null; body: string } {
  if (!contents.startsWith('---\n')) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG001',
        `Catalog explanation ${catalogPath} must start with YAML frontmatter.`,
        { filePath: catalogPath, path: [], context: 'visual language catalog' },
        'Add a frontmatter block delimited by --- at the top of explanation.md.'
      )
    );
    return { frontmatter: null, body: contents };
  }

  const endIndex = contents.indexOf('\n---', 4);
  if (endIndex === -1) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG002',
        `Catalog explanation ${catalogPath} has unterminated frontmatter.`,
        { filePath: catalogPath, path: [], context: 'visual language catalog' },
        'Close the frontmatter block with --- on its own line.'
      )
    );
    return { frontmatter: null, body: contents };
  }

  const parsed = parseYaml(contents.slice(4, endIndex));
  if (!isRecord(parsed)) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG003',
        `Catalog explanation ${catalogPath} frontmatter must be an object.`,
        { filePath: catalogPath, path: [], context: 'visual language catalog' }
      )
    );
    return { frontmatter: null, body: contents.slice(endIndex + 5) };
  }

  return {
    frontmatter: parsed,
    body: contents.slice(endIndex + 5),
  };
}

function readExplanationFrontmatter(
  context: CatalogReadContext,
  record: Record<string, unknown>,
  catalogPath: string
): ExplanationFrontmatter | null {
  warnUnknownKeys(context, record, catalogPath, [
    'id',
    'category',
    'name',
    'summary',
    'promptTemplate',
    'illustration',
    'tags',
    'appliesTo',
    'difficulty',
  ]);

  const id = readRequiredString(context, record, catalogPath, 'id');
  const category = readRequiredString(context, record, catalogPath, 'category');
  const name = readRequiredString(context, record, catalogPath, 'name');
  const summary = readRequiredString(context, record, catalogPath, 'summary');
  const promptTemplate = readRequiredString(
    context,
    record,
    catalogPath,
    'promptTemplate'
  );
  const illustration = readIllustration(context, record.illustration, catalogPath);
  const tags = readOptionalStringArray(context, record, catalogPath, 'tags');
  const appliesTo = readOptionalStringArray(context, record, catalogPath, 'appliesTo');
  const difficulty = readOptionalDifficulty(context, record, catalogPath);

  if (!id || !category || !name || !summary || !promptTemplate || !illustration) {
    return null;
  }

  return {
    id,
    category,
    name,
    summary,
    promptTemplate,
    illustration,
    tags,
    appliesTo,
    difficulty,
  };
}

function readIllustration(
  context: CatalogReadContext,
  input: unknown,
  catalogPath: string
): VisualLanguageCatalogIllustration | null {
  if (!isRecord(input)) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG004',
        `${catalogPath} frontmatter illustration must be an object.`,
        {
          filePath: catalogPath,
          path: ['illustration'],
          context: 'visual language catalog',
        }
      )
    );
    return null;
  }
  const file = readRequiredString(context, input, catalogPath, 'file', [
    'illustration',
  ]);
  const mediaKind = readRequiredString(context, input, catalogPath, 'mediaKind', [
    'illustration',
  ]);
  if (mediaKind !== 'image' && mediaKind !== 'video') {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG005',
        `${catalogPath} illustration.mediaKind must be image or video.`,
        {
          filePath: catalogPath,
          path: ['illustration', 'mediaKind'],
          context: 'visual language catalog',
        }
      )
    );
  }
  if (!file || (mediaKind !== 'image' && mediaKind !== 'video')) {
    return null;
  }
  return {
    catalogRelativePath: file,
    mediaKind,
  };
}

function readRequiredString(
  context: CatalogReadContext,
  record: Record<string, unknown>,
  catalogPath: string,
  key: string,
  pathPrefix: string[] = []
): string | null {
  const value = record[key];
  const fieldPath = [...pathPrefix, key];
  if (value === undefined) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG004',
        `${catalogPath} frontmatter ${fieldPath.join('.')} is required.`,
        { filePath: catalogPath, path: fieldPath, context: 'visual language catalog' }
      )
    );
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG004',
        `${catalogPath} frontmatter ${fieldPath.join('.')} must be a non-empty string.`,
        { filePath: catalogPath, path: fieldPath, context: 'visual language catalog' }
      )
    );
    return null;
  }
  return value;
}

function readOptionalStringArray(
  context: CatalogReadContext,
  record: Record<string, unknown>,
  catalogPath: string,
  key: string
): string[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG006',
        `${catalogPath} frontmatter ${key} must be an array of strings.`,
        { filePath: catalogPath, path: [key], context: 'visual language catalog' }
      )
    );
    return [];
  }
  return value;
}

function readOptionalDifficulty(
  context: CatalogReadContext,
  record: Record<string, unknown>,
  catalogPath: string
): VisualLanguageCatalogDifficulty | undefined {
  const value = record.difficulty;
  if (value === undefined) {
    return undefined;
  }
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }
  context.issues.push(
    createDiagnosticError(
      'VISUAL_LANGUAGE_CATALOG007',
      `${catalogPath} frontmatter difficulty must be beginner, intermediate, or advanced.`,
      { filePath: catalogPath, path: ['difficulty'], context: 'visual language catalog' }
    )
  );
  return undefined;
}

function resolveCatalogEntryPath(
  context: CatalogReadContext,
  input: {
    entryDir: string;
    relativePath: string;
    sourcePath: string;
    field: string;
  }
): string | null {
  if (path.isAbsolute(input.relativePath)) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG008',
        `${input.sourcePath} frontmatter ${input.field} must be relative.`,
        {
          filePath: input.sourcePath,
          path: [input.field],
          context: 'visual language catalog',
        }
      )
    );
    return null;
  }
  const resolvedPath = path.resolve(input.entryDir, input.relativePath);
  const relativeToRoot = path.relative(context.catalogRoot, resolvedPath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    context.issues.push(
      createDiagnosticError(
        'VISUAL_LANGUAGE_CATALOG008',
        `${input.sourcePath} frontmatter ${input.field} must stay inside the catalog root.`,
        {
          filePath: input.sourcePath,
          path: [input.field],
          context: 'visual language catalog',
        }
      )
    );
    return null;
  }
  return resolvedPath;
}

async function readRequiredCatalogFile(
  context: CatalogReadContext,
  input: {
    filePath: string;
    sourcePath: string;
    field: string;
  }
): Promise<string | null> {
  try {
    return await fs.readFile(input.filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      context.issues.push(
        createDiagnosticError(
          'VISUAL_LANGUAGE_CATALOG009',
          `${input.sourcePath} frontmatter ${input.field} references a missing file.`,
          {
            filePath: input.sourcePath,
            path: [input.field],
            context: 'visual language catalog',
          },
          'Create the referenced catalog file or update the frontmatter path.'
        )
      );
      return null;
    }
    throw error;
  }
}

function warnUnknownKeys(
  context: CatalogReadContext,
  record: Record<string, unknown>,
  catalogPath: string,
  allowedKeys: string[]
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (allowed.has(key)) {
      continue;
    }
    context.issues.push(
      createDiagnosticWarning(
        'VISUAL_LANGUAGE_CATALOG100',
        `Unknown catalog frontmatter field ${key} will be ignored.`,
        { filePath: catalogPath, path: [key], context: 'visual language catalog' },
        'Remove the field or rename it to a supported catalog frontmatter field.'
      )
    );
  }
}

function toCatalogRelativePath(catalogRoot: string, filePath: string): string {
  return path.relative(catalogRoot, filePath).split(path.sep).join('/');
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isNodeError(error: unknown): error is Error & { code?: unknown } {
  return error instanceof Error && 'code' in error;
}
