import type { ProjectRelativePath } from './project.js';

export type ProductionExportVariant =
  | { kind: 'master' }
  | { kind: 'localized'; localeId: string };

export interface ProductionExportInput {
  projectName: string;
  variants?: ProductionExportVariant[];
  fresh?: boolean;
  dryRun?: boolean;
}

export interface ProductionExportSummary {
  copiedFileCount: number;
  skippedFileCount: number;
  prunedFileCount: number;
  unmanagedFileCount: number;
  variants: ProductionExportVariantSummary[];
}

export interface ProductionExportVariantSummary {
  variant: ProductionExportVariant;
  rootProjectRelativePath: ProjectRelativePath;
  treeHash: string;
  copiedFileCount: number;
  skippedFileCount: number;
  prunedFileCount: number;
}
