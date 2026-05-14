import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { CatalogReadContext } from './contracts.js';

export async function findExplanationFiles(catalogRoot: string): Promise<string[]> {
  const paths: string[] = [];
  await walk(catalogRoot, paths);
  return paths.sort();
}

export function resolveCatalogEntryPath(
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

export async function readRequiredCatalogFile(
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

export function toCatalogRelativePath(catalogRoot: string, filePath: string): string {
  return path.relative(catalogRoot, filePath).split(path.sep).join('/');
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

function isNodeError(error: unknown): error is Error & { code?: unknown } {
  return error instanceof Error && 'code' in error;
}
