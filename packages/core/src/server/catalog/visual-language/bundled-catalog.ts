import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VisualLanguageCatalogError } from './errors.js';

export async function resolveBundledVisualLanguageCatalogRoot(): Promise<string> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const catalogRoot = path.resolve(
    moduleDir,
    '..',
    '..',
    '..',
    '..',
    'catalog',
    'visual-language'
  );
  try {
    await fs.access(catalogRoot, fsConstants.R_OK);
    const stats = await fs.stat(catalogRoot);
    if (stats.isDirectory()) {
      return catalogRoot;
    }
  } catch {
    // The structured package-content error below owns every inaccessible case.
  }
  throw new VisualLanguageCatalogError(
    'VISUAL_LANGUAGE_CATALOG999',
    'The bundled Visual Language Catalog is missing or unreadable.',
    {
      suggestion: 'Repair or reinstall Renku, then try again.',
    }
  );
}
