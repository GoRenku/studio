import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectRelativePath } from './project.js';
import type { RecoverableMutationReport } from './trash.js';

export interface InspirationFolder {
  id: string;
  name: string;
  projectRelativePath: ProjectRelativePath;
}

export interface InspirationFolderWithResolvedPath extends InspirationFolder {
  absolutePath: string;
}

export interface InspirationFolderListItem {
  folder: InspirationFolder;
  cardImage: InspirationImage | null;
  imageCount: number;
}

export interface InspirationImage {
  fileName: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image';
  sizeBytes?: number;
}

export interface InspirationAnalysis {
  folderId: string;
  thesis: ThesisSection;
  palette: PaletteSection;
  toneMood: ToneMoodSection;
  composition: PatternSection;
  lighting: PatternSection;
  texture: TextureSection;
  inspiredBy: InspiredBySection;
}

export type LookbookType = 'movie' | 'storyboard';

export interface MovieLookbook {
  id: string;
  name: string;
  type: 'movie';
  definition: MovieLookbookDefinition;
}

export interface StoryboardLookbook {
  id: string;
  name: string;
  type: 'storyboard';
  definition: StoryboardLookbookDefinition;
  sourceMovieLookbookIds: string[];
}

export type Lookbook = MovieLookbook | StoryboardLookbook;

export interface LookbookListItem {
  lookbook: Lookbook;
  cardImage: LookbookImage | null;
  isSelectedForType: boolean;
}

export interface LookbookListItemWithSources extends LookbookListItem {
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}

export interface MovieLookbookDefinition {
  thesis: ThesisSection;
  palette: PaletteSection;
  toneMood: ToneMoodSection;
  composition: PatternSection;
  lighting: PatternSection;
  texture: TextureSection;
  camera: CameraSection;
}

export interface StoryboardLookbookDefinition {
  styleBrief: StoryboardStyleBriefSection;
  lineAndFinish: StoryboardLineAndFinishSection;
  valueAndAccent: StoryboardValueAndAccentSection;
  guardrails: StoryboardGuardrailsSection;
}

export interface StoryboardLookbookTextSection {
  text: string;
}

/**
 * Style brief: the overall medium, substrate, and palette. `text` is the
 * prompt-facing source of truth; the optional fields drive the section widgets
 * and are style-agnostic (graphite, realistic, cartoon, full colour, ...).
 */
export interface StoryboardStyleBriefSection extends StoryboardLookbookTextSection {
  styleKind?: string;
  palette?: ColorSwatch[];
  tags?: string[];
}

export interface StoryboardLineAndFinishSection
  extends StoryboardLookbookTextSection {
  marks?: StoryboardMark[];
  hatching?: string;
}

export interface StoryboardMark {
  label: string;
  thickness: number;
}

export interface StoryboardValueAndAccentSection
  extends StoryboardLookbookTextSection {
  valueSteps?: string[];
  contrast?: string;
  accents?: ColorSwatch[];
}

export interface StoryboardGuardrailsSection
  extends StoryboardLookbookTextSection {
  forbidden?: string[];
  favored?: string[];
}

export type MovieLookbookSection =
  | 'thesis'
  | 'palette'
  | 'toneMood'
  | 'composition'
  | 'lighting'
  | 'texture'
  | 'camera';

export type StoryboardLookbookSection =
  | 'styleBrief'
  | 'lineAndFinish'
  | 'valueAndAccent'
  | 'guardrails';

export type LookbookSection = MovieLookbookSection | StoryboardLookbookSection;

export type LookbookSectionsByType = {
  movie: MovieLookbookSection;
  storyboard: StoryboardLookbookSection;
};

export type LookbookDefinitionByType = {
  movie: MovieLookbookDefinition;
  storyboard: StoryboardLookbookDefinition;
};

export interface LookbookImage {
  id: string;
  lookbookId: string;
  lookbookType: LookbookType;
  asset: LookbookImageAsset;
  /** Sections this image is section-level evidence for (un-anchored placements). */
  sections: LookbookSection[];
  /** Point ids this image is anchored to (e.g. a specific pattern or observation). */
  points?: string[];
}

export interface LookbookSheet {
  id: string;
  lookbookId: string;
  lookbookType: LookbookType;
  asset: LookbookSheetAsset;
}

export interface LookbookImageAsset {
  assetId: string;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string;
  origin: string;
  availability: string;
  files: LookbookImageAssetFile[];
  createdAt: string;
  updatedAt: string;
}

export interface LookbookSheetAsset {
  assetId: string;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string;
  origin: string;
  availability: string;
  files: LookbookSheetAssetFile[];
  createdAt: string;
  updatedAt: string;
}

export interface LookbookImageAssetFile {
  id: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: string;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface LookbookSheetAssetFile {
  id: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: string;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface ThesisSection {
  statement: string;
  principles: string[];
  imageFiles?: string[];
}

export interface PaletteSection {
  description: string;
  colors: ColorSwatch[];
  observations: Observation[];
}

export interface ColorSwatch {
  hex: string;
  name: string;
  meaning: string;
}

export interface Observation {
  id?: string;
  text: string;
  imageFiles?: string[];
}

export interface ToneMoodSection {
  tone: string;
  moodTags: string[];
  description: string;
  imageFiles?: string[];
}

export interface PatternSection {
  description: string;
  patterns: Pattern[];
}

export interface Pattern {
  id?: string;
  name: string;
  description: string;
  imageFiles?: string[];
}

export interface TextureSection {
  description: string;
  observations: Observation[];
}

export interface InspiredBySection {
  description: string;
  items: InspiredByItem[];
}

export interface InspiredByItem {
  category: 'movie' | 'director' | 'cinematographer';
  name: string;
  confidence: 'low' | 'medium' | 'high';
  why: string;
  imageFiles?: string[];
}

export interface CameraSection {
  description: string;
  movement: Pattern[];
  motion: Pattern[];
  framing: Pattern[];
}

export interface VisualLanguageProjectReport {
  name: string;
  id?: string;
  projectFolder?: string;
}

export interface VisualLanguageChange {
  type: string;
  [key: string]: string;
}

export interface VisualLanguageCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: VisualLanguageProjectReport;
  changes?: VisualLanguageChange[];
  recovery?: RecoverableMutationReport['recovery'];
  resourceKeys: string[];
}

export interface InspirationFolderReport extends VisualLanguageCommandReport {
  folder: InspirationFolderWithResolvedPath;
  analysis: InspirationAnalysis | null;
}

export interface InspirationFolderMutationReport
  extends VisualLanguageCommandReport {
  folder: InspirationFolder;
}

export interface InspirationFolderReorderReport
  extends VisualLanguageCommandReport {
  folders: {
    items: InspirationFolder[];
    nextCursor?: string | null;
  };
}

export interface InspirationFolderDeleteReport
  extends VisualLanguageCommandReport {
  folderId: string;
}

export interface InspirationFolderResourceMutationReport
  extends VisualLanguageCommandReport {
  resource: {
    folder: InspirationFolder;
    images: InspirationImage[];
    analysis: InspirationAnalysis | null;
  };
}

export interface InspirationAnalysisValidationReport
  extends VisualLanguageCommandReport {
  folder: InspirationFolderWithResolvedPath;
}

export interface InspirationAnalysisWriteReport
  extends VisualLanguageCommandReport {
  folder: InspirationFolderWithResolvedPath;
  analysis: InspirationAnalysis;
}

export interface LookbookListReport extends VisualLanguageCommandReport {
  selectedLookbookIdsByType: Partial<Record<LookbookType, string>>;
  lookbooks: LookbookListItemWithSources[];
}

export interface LookbookShowReport extends VisualLanguageCommandReport {
  lookbook: Lookbook;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
  cardImage: LookbookImage | null;
  isSelectedForType: boolean;
  images: LookbookImage[];
  sheets: LookbookSheet[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
}

export interface LookbookValidationReport extends VisualLanguageCommandReport {
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}

export interface LookbookWriteReport extends VisualLanguageCommandReport {
  lookbook: Lookbook;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}

export interface LookbookImageMutationReport extends VisualLanguageCommandReport {
  image?: LookbookImage;
  lookbookId: string;
}

export interface LookbookSheetMutationReport extends VisualLanguageCommandReport {
  sheet?: LookbookSheet;
  lookbookId: string;
}

export interface LookbookSourceInspirationsReport
  extends VisualLanguageCommandReport {
  lookbookId: string;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}
