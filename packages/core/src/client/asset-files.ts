import type { ProjectRelativePath } from './project/index.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { MediaGenerationProvenance } from './media-generation-review.js';

export interface ImportReferenceFilesInput {
  projectName: string;
  homeDir?: string;
  destination: { kind: 'inspiration'; folderId: string } | { kind: 'research' };
  files: { sourceProjectRelativePath: string; title?: string }[];
}

export interface ReferenceFilesImportReport {
  valid: true;
  assetFiles: AssetFile[];
  warnings: DiagnosticIssue[];
  project: { projectName: string; id: string; projectFolder: string };
  resourceKeys: string[];
}

export type AssetFileOwner =
  | { kind: 'project' }
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'prop'; id: string }
  | { kind: 'scene'; id: string }
  | { kind: 'sceneBeat'; sceneId: string; beatId: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'inspirationFolder'; id: string }
  | { kind: 'shot'; id: string };

export type AssetFileSelectionTarget =
  | { kind: 'project' }
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'locationWorld'; id: string }
  | { kind: 'prop'; id: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'shot'; id: string }
  | { kind: 'sceneBeat'; sceneId: string; beatId: string };

export interface AssetFileLocaleContext {
  localeId?: string | null;
}

export interface AssetFileMetadataInput {
  oneLineSummary?: string | null;
  referenceName?: string | null;
  tags?: string[];
}

export interface UpdateAssetFileInput extends AssetFileMetadataInput {
  projectName: string;
  assetFileId: string;
  title?: string | null;
  localeId?: string | null;
}

export interface AssetFileUpdateReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    projectName: string;
    id: string;
    projectFolder: string;
  };
  assetFile: AssetFile;
  resourceKeys: string[];
}

export interface SelectAssetFileInput {
  projectName: string;
  target: AssetFileSelectionTarget;
  assetFileId: string;
}

export interface ClearAssetFileSelectionInput {
  projectName: string;
  target: AssetFileSelectionTarget;
}

export interface AssetFileSelectionReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    projectName: string;
    id: string;
    projectFolder: string;
  };
  target: AssetFileSelectionTarget;
  selectedAssetFileId: string | null;
  resourceKeys: string[];
}

export interface AssetFile {
  id: string;
  owner: AssetFileOwner;
  localeId: string | null;
  type: string;
  availability: AssetFileAvailability;
  mediaKind: string;
  title: string | null;
  oneLineSummary: string | null;
  origin: string;
  referenceName: string | null;
  tags: string[];
  generationProvenance: MediaGenerationProvenance | null;
  authoredFrom: { kind: 'shotPlan'; id: string; previsRevisionId?: string } | null;
  projectRelativePath: ProjectRelativePath;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetFilePage {
  items: AssetFile[];
  nextCursor: string | null;
  selectedAssetFileId: string | null;
}

export type AssetFileAvailability = 'ready';
