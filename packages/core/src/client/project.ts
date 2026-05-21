import type { CastMember } from './cast-members.js';
import type { ContinuityReference } from './continuity-references.js';
import type { Episode, Sequence } from './screenplay-projection.js';
import type { ProjectLanguage } from './project-languages.js';
import type {
  VisualLanguage,
  VisualLanguageCategory,
} from './visual-language.js';
import type { RichTextAssetLink } from './assets.js';

export type ProjectType = 'standaloneMovie' | 'series';
export type ProjectRelativePath = string & { readonly __brand: 'ProjectRelativePath' };

export interface Project {
  identity: ProjectInfo;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguageCategories: VisualLanguageCategory[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  continuityReferences: ContinuityReference[];
  episodes: Episode[];
  sequences: Sequence[];
  counts: ProjectCounts;
}

export interface ProjectInfo {
  id: string;
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  databasePath: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
  summaryAsset?: RichTextAssetLink;
}

export interface ProjectCoverImage {
  fileName: 'cover.png';
}

export interface ProjectCounts {
  languages: number;
  visualLanguageCategories: number;
  visualLanguage: number;
  castMembers: number;
  continuityReferences: number;
  episodes: number;
  sequences: number;
  scenes: number;
  clips: number;
}

export interface ProjectCreateReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  coverPath: string | null;
  created: ProjectCounts;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}
