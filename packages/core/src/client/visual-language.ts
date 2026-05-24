import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectRelativePath } from './project.js';

export interface InspirationFolder {
  id: string;
  name: string;
  projectRelativePath: ProjectRelativePath;
}

export interface InspirationFolderWithResolvedPath extends InspirationFolder {
  absolutePath: string;
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

export interface Lookbook {
  id: string;
  name: string;
  thesis: ThesisSection;
  palette: PaletteSection;
  toneMood: ToneMoodSection;
  composition: PatternSection;
  lighting: PatternSection;
  texture: TextureSection;
  camera: CameraSection;
}

export interface LookbookListItem {
  lookbook: Lookbook;
  cardImage: LookbookImage | null;
  isActive: boolean;
}

export type LookbookSection =
  | 'thesis'
  | 'palette'
  | 'tone_mood'
  | 'composition'
  | 'lighting'
  | 'texture'
  | 'camera';

export interface LookbookImage {
  id: string;
  asset: LookbookImageAsset;
  sections: LookbookSection[];
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
  resourceKeys: string[];
}

export interface InspirationFolderReport extends VisualLanguageCommandReport {
  folder: InspirationFolderWithResolvedPath;
  analysis: InspirationAnalysis | null;
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
