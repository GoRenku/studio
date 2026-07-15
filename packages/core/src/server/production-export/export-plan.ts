import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import type { ProductionExportVariant } from '../../client/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  readProductionLocaleTag,
  refreshProductionAssetFileMetadata,
  type ProductionExportMediaRow,
} from '../database/access/production-export.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { allocateProductionAssetPath } from './production-asset-paths.js';
import { buildProductionTreeHash } from './tree-hash.js';
import type {
  DesiredProductionExportFile,
  ProductionExportFileManifest,
  ProductionExportManifest,
  ProductionExportVariantPlan,
} from './types.js';

export async function buildProductionVariantPlans(input: {
  projectFolder: string;
  session: DatabaseSession;
  variants: ProductionExportVariant[];
  mediaRows: ProductionExportMediaRow[];
  previousManifest: ProductionExportManifest | null;
  dryRun: boolean;
}): Promise<ProductionExportVariantPlan[]> {
  const plans: ProductionExportVariantPlan[] = [];
  for (const variant of input.variants) {
    const rootProjectRelativePath =
      variant.kind === 'master'
        ? normalizeProjectRelativePath('production-assets/master')
        : joinProjectRelativePath(
            'production-assets',
            'localized',
            readProductionLocaleTag(input.session, variant.localeId)
          );
    const files: DesiredProductionExportFile[] = [];
    for (const row of input.mediaRows) {
      if (!rowBelongsToVariant(row, variant)) {
        continue;
      }
      const sourceProjectRelativePath = normalizeProjectRelativePath(
        row.sourceProjectRelativePath
      );
      const sourcePath = resolveProjectRelativePath(
        input.projectFolder,
        sourceProjectRelativePath
      );
      const stats = await statSourceFile(sourcePath, row);
      const sourceHash = await computeSourceHash({
        sourcePath,
        sourceSizeBytes: stats.size,
        sourceModifiedAt: stats.mtime.toISOString(),
        previousFile: findPreviousFileForAssetFile(
          input.previousManifest,
          row.assetFileId
        ),
      });
      if (!input.dryRun && sourceHash.metadataNeedsRefresh) {
        refreshProductionAssetFileMetadata({
          session: input.session,
          assetFileId: row.assetFileId,
          contentHash: sourceHash.contentHash,
          sizeBytes: stats.size,
        });
      }
      files.push({
        assetId: row.assetId,
        relationshipId: row.relationshipId,
        assetFileId: row.assetFileId,
        sourceProjectRelativePath,
        targetProjectRelativePath: allocateProductionAssetPath(
          input.session,
          row,
          variant,
          rootProjectRelativePath
        ),
        sourceContentHash: sourceHash.contentHash,
        sourceSizeBytes: stats.size,
        sourceModifiedAt: stats.mtime.toISOString(),
        role: row.role,
        variant,
        variantRootProjectRelativePath: rootProjectRelativePath,
      });
    }
    plans.push({
      variant,
      rootProjectRelativePath,
      files,
      treeHash: buildProductionTreeHash(rootProjectRelativePath, variant, files),
    });
  }
  return plans;
}

function rowBelongsToVariant(
  row: ProductionExportMediaRow,
  variant: ProductionExportVariant
): boolean {
  if (variant.kind === 'master') {
    return row.localeId === null;
  }
  return row.localeId === variant.localeId;
}

async function statSourceFile(
  sourcePath: string,
  row: ProductionExportMediaRow
): Promise<{ size: number; mtime: Date }> {
  try {
    const stats = await fs.stat(sourcePath);
    if (!stats.isFile()) {
      throw new ProjectDataError(
        'PROJECT_DATA104',
        `Selected production asset source is not a file: ${row.sourceProjectRelativePath}.`
      );
    }
    return { size: stats.size, mtime: stats.mtime };
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA105',
      `Selected production asset source file is missing: ${row.sourceProjectRelativePath}.`
    );
  }
}

async function computeSourceHash(input: {
  sourcePath: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string;
  previousFile: ProductionExportFileManifest | null;
}): Promise<{ contentHash: string; metadataNeedsRefresh: boolean }> {
  if (
    input.previousFile?.sourceContentHash &&
    input.previousFile.sourceSizeBytes === input.sourceSizeBytes &&
    input.previousFile.sourceModifiedAt === input.sourceModifiedAt
  ) {
    return {
      contentHash: input.previousFile.sourceContentHash,
      metadataNeedsRefresh: false,
    };
  }
  return {
    contentHash: await fileContentHash(input.sourcePath),
    metadataNeedsRefresh: true,
  };
}

function findPreviousFileForAssetFile(
  manifest: ProductionExportManifest | null,
  assetFileId: string
): ProductionExportFileManifest | null {
  return (
    manifest?.variants
      .flatMap((variant) => variant.files)
      .find((file) => file.assetFileId === assetFileId) ?? null
  );
}

async function fileContentHash(filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
