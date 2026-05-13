export const PROJECT_KIND = 'renku.project' as const;
export const WORKFLOW_KIND = 'renku.workflow' as const;
export const TASK_KIND = 'renku.task' as const;

export type ProjectKind = typeof PROJECT_KIND;
export type WorkflowKind = typeof WORKFLOW_KIND;
export type TaskKind = typeof TASK_KIND;

export interface StudioCorePackageInfo {
  packageName: '@gorenku/studio-core';
  purpose: 'renku-studio-domain';
}

export function getStudioCorePackageInfo(): StudioCorePackageInfo {
  return {
    packageName: '@gorenku/studio-core',
    purpose: 'renku-studio-domain',
  };
}

export type {
  Asset,
  AssetAvailability,
  AssetFile,
  AssetLocaleContext,
  AssetReference,
  AssetSelection,
  AssetTarget,
  CastDesignAssetRoleCount,
  CastDesignResource,
  CastMember,
  CastNavigationRow,
  ContinuityReference,
  ContinuityReferenceNavigationRow,
  Clip,
  ClipDesignResource,
  ClipNavigationRow,
  Episode,
  EpisodeNavigationRow,
  MovieStudioSelection,
  MovieStudioSelectionContext,
  MovieStudioSelectionContextResult,
  PageResponse,
  Project,
  ProjectCoverImage,
  ProjectCounts,
  ProjectCreateReport,
  ProjectDataErrorContract,
  ProjectIdentity,
  ProjectLanguage,
  ProjectLibrary,
  ProjectShell,
  ProjectShellNavigation,
  ProjectRelativePath,
  MarkdownAssetContent,
  ProductionExportInput,
  ProductionExportSummary,
  ProductionExportVariant,
  ProductionExportVariantSummary,
  RegisterAssetInput,
  RichTextAssetLink,
  ProjectSummary,
  ProjectType,
  Scene,
  SceneNavigationRow,
  Sequence,
  SequenceNavigationRow,
  StoryStructureNavigation,
  VisualLanguage,
  VisualLanguageCategory,
  VisualLanguageCategorySource,
  VisualLanguageNavigationRow,
  VisualLanguagePriority,
} from './project/index.js';
export type {
  ReadVisualLanguageCatalogEntryInput,
  ReadVisualLanguageCatalogInput,
  VisualLanguageCatalog,
  VisualLanguageCatalogDifficulty,
  VisualLanguageCatalogEntry,
  VisualLanguageCatalogIllustration,
} from './visual-language-catalog/index.js';
export { ProjectDataError } from './project/index.js';
