export {
  PROJECT_KIND,
  getStudioCorePackageInfo,
} from './package-info.js';
export type {
  ProjectKind,
  StudioCorePackageInfo,
} from './package-info.js';
export type {
  Asset,
  AssetAvailability,
  AssetFile,
  AssetLocaleContext,
  AssetReference,
  AssetSelection,
  AssetTarget,
  MarkdownAssetContent,
  RegisterAssetInput,
  RichTextAssetLink,
} from './assets.js';
export type {
  CastMember,
} from './cast-members.js';
export type {
  ContinuityReference,
} from './continuity-references.js';
export type {
  Clip,
  Episode,
  Scene,
  Sequence,
} from './screenplay-projection.js';
export type {
  ProductionExportInput,
  ProductionExportSummary,
  ProductionExportVariant,
  ProductionExportVariantSummary,
} from './production-export.js';
export type {
  ProjectLanguage,
} from './project-languages.js';
export type {
  CastDesignAssetRoleCount,
  CastDesignResource,
  CastNavigationRow,
  ClipDesignResource,
  ClipNavigationRow,
  ContinuityReferenceNavigationRow,
  EpisodeNavigationRow,
  ScreenplayNavigation,
  PageResponse,
  ProjectInformationResource,
  ProjectShell,
  ProjectShellNavigation,
  SceneNavigationRow,
  SequenceNavigationRow,
  StudioSelection,
  StudioSelectionContext,
  StudioSelectionContextResult,
  VisualLanguageNavigationRow,
} from './resources.js';
export type {
  Project,
  ProjectCoverImage,
  ProjectCounts,
  ProjectCreateReport,
  ProjectInfo,
  ProjectRelativePath,
  ProjectType,
} from './project.js';
export type {
  ProjectLibrary,
  ProjectSummary,
} from './project-library.js';
export type {
  VisualLanguage,
  VisualLanguageCategory,
  VisualLanguageCategorySource,
  VisualLanguagePriority,
} from './visual-language.js';
export type {
  ProjectDataErrorContract,
} from './diagnostics.js';
export {
  screenplayBlockSchema,
  screenplayDocumentSchema,
  screenplayOperationsSchema,
  screenplayReferenceSchema,
} from './screenplay-json-schemas.js';
export type {
  ReadVisualLanguageCatalogEntryInput,
  ReadVisualLanguageCatalogInput,
  VisualLanguageCatalog,
  VisualLanguageCatalogDifficulty,
  VisualLanguageCatalogEntry,
  VisualLanguageCatalogIllustration,
} from './visual-language-catalog.js';
