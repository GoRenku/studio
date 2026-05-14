import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProductionExportVariant } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { fileExists } from './file-sync.js';
import type {
  ProductionExportManifest,
  ProductionExportVariantManifest,
  ProductionExportVariantPlan,
} from './types.js';

const MANIFEST_PATH = normalizeProjectRelativePath(
  'production-assets/manifest/production-export-manifest.json'
);

export async function readProductionExportManifest(
  projectFolder: string,
  projectId: string
): Promise<ProductionExportManifest | null> {
  const manifestPath = resolveProjectRelativePath(projectFolder, MANIFEST_PATH);
  if (!(await fileExists(manifestPath))) {
    return null;
  }
  try {
    const manifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf8')
    ) as ProductionExportManifest;
    if (manifest.schemaVersion !== 1 || manifest.projectId !== projectId) {
      throw new ProjectDataError(
        'PROJECT_DATA108',
        'Production export manifest is not valid for this project.'
      );
    }
    return manifest;
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA109',
      'Production export manifest could not be read.'
    );
  }
}

export async function writeProductionExportManifest(
  projectFolder: string,
  manifest: ProductionExportManifest
): Promise<void> {
  const manifestPath = resolveProjectRelativePath(projectFolder, MANIFEST_PATH);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function findPreviousProductionVariant(
  manifest: ProductionExportManifest | null,
  variant: ProductionExportVariant
): ProductionExportVariantManifest | null {
  return (
    manifest?.variants.find((entry) => {
      if (variant.kind === 'master') {
        return entry.variant === 'master';
      }
      return entry.variant === 'localized' && entry.localeId === variant.localeId;
    }) ?? null
  );
}

export function toProductionManifestVariant(
  plan: ProductionExportVariantPlan
): ProductionExportVariantManifest {
  return {
    variant: plan.variant.kind === 'master' ? 'master' : 'localized',
    localeId: plan.variant.kind === 'localized' ? plan.variant.localeId : null,
    rootProjectRelativePath: plan.rootProjectRelativePath,
    treeHash: plan.treeHash,
    files: plan.files.map((file) => ({
      assetId: file.assetId,
      relationshipId: file.relationshipId,
      assetFileId: file.assetFileId,
      sourceProjectRelativePath: file.sourceProjectRelativePath,
      targetProjectRelativePath: file.targetProjectRelativePath,
      sourceContentHash: file.sourceContentHash,
      sourceSizeBytes: file.sourceSizeBytes,
      sourceModifiedAt: file.sourceModifiedAt,
      role: file.role,
    })),
  };
}
