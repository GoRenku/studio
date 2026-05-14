import type {
  ProductionExportVariant,
  ProjectRelativePath,
} from '../../client/index.js';

export interface DesiredProductionExportFile {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  sourceProjectRelativePath: ProjectRelativePath;
  targetProjectRelativePath: ProjectRelativePath;
  sourceContentHash: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string | null;
  role: string;
  variant: ProductionExportVariant;
  variantRootProjectRelativePath: ProjectRelativePath;
}

export interface ProductionExportManifest {
  schemaVersion: 1;
  projectId: string;
  exportedAt: string;
  variants: ProductionExportVariantManifest[];
}

export interface ProductionExportVariantManifest {
  variant: 'master' | 'localized';
  localeId: string | null;
  rootProjectRelativePath: string;
  treeHash: string;
  files: ProductionExportFileManifest[];
}

export interface ProductionExportFileManifest {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  sourceProjectRelativePath: string;
  targetProjectRelativePath: string;
  sourceContentHash: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string | null;
  role: string;
}

export interface ProductionExportVariantPlan {
  variant: ProductionExportVariant;
  rootProjectRelativePath: ProjectRelativePath;
  treeHash: string;
  files: DesiredProductionExportFile[];
}

export interface ProductionExportCounters {
  copied: number;
  skipped: number;
  pruned: number;
}
