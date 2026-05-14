import fs from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import type {
  ProductionExportCounters,
  ProductionExportFileManifest,
  ProductionExportVariantManifest,
  ProductionExportVariantPlan,
} from './types.js';

export async function syncProductionVariant(input: {
  projectFolder: string;
  plan: ProductionExportVariantPlan;
  previousVariant: ProductionExportVariantManifest | null;
  dryRun: boolean;
}): Promise<ProductionExportCounters> {
  if (input.previousVariant?.treeHash === input.plan.treeHash) {
    let copied = 0;
    let skipped = 0;
    for (const file of input.plan.files) {
      const targetPath = resolveProjectRelativePath(
        input.projectFolder,
        file.targetProjectRelativePath
      );
      if (await fileExists(targetPath)) {
        skipped += 1;
        continue;
      }
      const sourcePath = resolveProjectRelativePath(
        input.projectFolder,
        file.sourceProjectRelativePath
      );
      if (!input.dryRun) {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
      }
      copied += 1;
    }
    return { copied, skipped, pruned: 0 };
  }

  const previousFiles = new Map(
    (input.previousVariant?.files ?? []).map((file) => [
      file.targetProjectRelativePath,
      file,
    ])
  );
  let copied = 0;
  let skipped = 0;
  for (const file of input.plan.files) {
    const previousFile = previousFiles.get(file.targetProjectRelativePath);
    if (
      previousFile?.sourceContentHash === file.sourceContentHash &&
      (await fileExists(
        resolveProjectRelativePath(input.projectFolder, file.targetProjectRelativePath)
      ))
    ) {
      skipped += 1;
      continue;
    }

    const sourcePath = resolveProjectRelativePath(
      input.projectFolder,
      file.sourceProjectRelativePath
    );
    const targetPath = resolveProjectRelativePath(
      input.projectFolder,
      file.targetProjectRelativePath
    );
    if (!input.dryRun) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
    }
    copied += 1;
  }
  return { copied, skipped, pruned: 0 };
}

export async function prunePreviousProductionFiles(input: {
  projectFolder: string;
  previousFiles: Map<string, ProductionExportFileManifest>;
  desiredTargetPaths: Set<string>;
  dryRun: boolean;
}): Promise<number> {
  let pruned = 0;
  for (const targetPath of input.previousFiles.keys()) {
    if (input.desiredTargetPaths.has(targetPath)) {
      continue;
    }
    const absoluteTargetPath = resolveProjectRelativePath(
      input.projectFolder,
      normalizeProjectRelativePath(targetPath)
    );
    if (!(await fileExists(absoluteTargetPath))) {
      continue;
    }
    if (!input.dryRun) {
      await fs.unlink(absoluteTargetPath);
    }
    pruned += 1;
  }
  return pruned;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
