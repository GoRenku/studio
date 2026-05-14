import {
  createDiagnosticError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import { parse as parseYaml } from 'yaml';
import type {
  VisualLanguageCatalogDifficulty,
  VisualLanguageCatalogIllustration,
} from '../../../client/index.js';
import type { CatalogReadContext, ExplanationFrontmatter } from './contracts.js';

export function parseCatalogFrontmatter(
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

export function readExplanationFrontmatter(
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
