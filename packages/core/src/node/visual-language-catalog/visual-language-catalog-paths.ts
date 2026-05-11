import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../config.js';

export const VISUAL_LANGUAGE_CATALOG_DIR_NAME = 'visual-language' as const;

export function resolveVisualLanguageCatalogRoot(
  options: RenkuConfigPathOptions & { catalogRoot?: string } = {}
): string {
  return path.resolve(
    options.catalogRoot ??
      path.join(resolveRenkuConfigDir(options), VISUAL_LANGUAGE_CATALOG_DIR_NAME)
  );
}

export async function ensureVisualLanguageCatalogRoot(
  options: RenkuConfigPathOptions & { catalogRoot?: string } = {}
): Promise<string> {
  const catalogRoot = resolveVisualLanguageCatalogRoot(options);
  if (await directoryExists(catalogRoot)) {
    return catalogRoot;
  }
  const bundledRoot = await resolveBundledVisualLanguageCatalogRoot();
  if (bundledRoot) {
    await fs.mkdir(path.dirname(catalogRoot), { recursive: true });
    await fs.cp(bundledRoot, catalogRoot, { recursive: true });
    return catalogRoot;
  }
  await fs.mkdir(catalogRoot, { recursive: true });
  return catalogRoot;
}

async function resolveBundledVisualLanguageCatalogRoot(): Promise<string | null> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '..', '..', '..', '..', 'catalog', 'visual-language'),
    path.resolve(moduleDir, '..', '..', '..', 'catalog', 'visual-language'),
    path.resolve(process.cwd(), 'packages', 'core', 'catalog', 'visual-language'),
  ];
  for (const candidate of candidates) {
    if (await directoryExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    await fs.access(directoryPath, fsConstants.R_OK);
    const stats = await fs.stat(directoryPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
