import type {
  ProductionExportInput,
  ProductionExportSummary,
  ProductionExportVariant,
  ProductionExportVariantSummary,
} from '../../client/index.js';
import {
  assertProductionExportLocaleExists,
  assertPickedTakesHaveReadyVideos,
  readProductionProjectInfo,
  readProductionExportMediaRows,
  type ProductionExportMediaRow,
} from '../database/access/production-export.js';
import { openProjectStore, type DatabaseSession } from '../database/lifecycle/store.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import { buildProductionVariantPlans } from './export-plan.js';
import {
  prunePreviousProductionFiles,
  syncProductionVariant,
} from './file-sync.js';
import {
  findPreviousProductionVariant,
  readProductionExportManifest,
  toProductionManifestVariant,
  writeProductionExportManifest,
} from './manifest.js';

export async function exportProductionAssets(
  input: ProductionExportInput & RenkuConfigPathOptions
): Promise<ProductionExportSummary> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({
    projectFolder,
    create: false,
    lifetime: 'project',
  });
  try {
    const project = readProductionProjectInfo(session);
    const mediaRows = readProductionExportMediaRows(session);
    assertPickedTakesHaveReadyVideos(session, mediaRows);
    const variants = readRequestedVariants(session, mediaRows, input.variants);
    const previousManifest = input.fresh
      ? null
      : await readProductionExportManifest(projectFolder, project.id);
    const plans = await buildProductionVariantPlans({
      projectFolder,
      session,
      variants,
      mediaRows,
      previousManifest,
      dryRun: input.dryRun === true,
    });

    if (plans.every((plan) => plan.files.length === 0)) {
      throw new ProjectDataError(
        'PROJECT_DATA100',
        'No picked Shot Video Take media is available for production export.'
      );
    }

    const targetPaths = new Set<string>();
    for (const file of plans.flatMap((plan) => plan.files)) {
      if (targetPaths.has(file.targetProjectRelativePath)) {
        throw new ProjectDataError(
          'PROJECT_DATA101',
          `Production export target path conflict: ${file.targetProjectRelativePath}.`
        );
      }
      targetPaths.add(file.targetProjectRelativePath);
    }

    const variantSummaries: ProductionExportVariantSummary[] = [];
    const desiredTargetPaths = new Set(
      plans.flatMap((plan) =>
        plan.files.map((file) => file.targetProjectRelativePath as string)
      )
    );
    const previousFiles = new Map(
      (previousManifest?.variants ?? [])
        .flatMap((variant) => variant.files)
        .map((file) => [file.targetProjectRelativePath, file])
    );

    for (const plan of plans) {
      const previousVariant = findPreviousProductionVariant(previousManifest, plan.variant);
      const counters = await syncProductionVariant({
        projectFolder,
        plan,
        previousVariant,
        dryRun: input.dryRun === true,
      });
      variantSummaries.push({
        variant: plan.variant,
        rootProjectRelativePath: plan.rootProjectRelativePath,
        treeHash: plan.treeHash,
        copiedFileCount: counters.copied,
        skippedFileCount: counters.skipped,
        prunedFileCount: 0,
      });
    }

    const prunedFileCount = await prunePreviousProductionFiles({
      projectFolder,
      previousFiles,
      desiredTargetPaths,
      dryRun: input.dryRun === true,
    });

    if (!input.dryRun) {
      await writeProductionExportManifest(projectFolder, {
        schemaVersion: 1,
        projectId: project.id,
        exportedAt: new Date().toISOString(),
        variants: plans.map(toProductionManifestVariant),
      });
    }

    const copiedFileCount = variantSummaries.reduce(
      (sum, variant) => sum + variant.copiedFileCount,
      0
    );
    const skippedFileCount = variantSummaries.reduce(
      (sum, variant) => sum + variant.skippedFileCount,
      0
    );

    return {
      copiedFileCount,
      skippedFileCount,
      prunedFileCount,
      unmanagedFileCount: 0,
      variants: variantSummaries.map((variant) => ({
        ...variant,
        prunedFileCount: 0,
      })),
    };
  } finally {
    session.close();
  }
}

function readRequestedVariants(
  session: DatabaseSession,
  mediaRows: ProductionExportMediaRow[],
  inputVariants?: ProductionExportVariant[]
): ProductionExportVariant[] {
  if (inputVariants?.length) {
    for (const variant of inputVariants) {
      if (variant.kind === 'localized') {
        assertProductionExportLocaleExists(session, variant.localeId);
      }
    }
    return inputVariants;
  }

  void mediaRows;
  return [{ kind: 'master' }];
}
