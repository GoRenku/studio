import type { CastMember } from './cast-members.js';
import type { Location } from './locations.js';
import type { Sequence } from './screenplay-projection.js';
import type { ProjectLanguage } from './project-languages.js';
import type {
  VisualLanguage,
  VisualLanguageCategory,
} from './visual-language.js';

export type ProjectRelativePath = string & { readonly __brand: 'ProjectRelativePath' };

export interface Project {
  identity: ProjectInfo;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguageCategories: VisualLanguageCategory[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  locations: Location[];
  sequences: Sequence[];
  counts: ProjectCounts;
}

export interface ProjectInfo {
  id: string;
  name: string;
  title: string;
  folderPath: string;
  databasePath: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
}

export interface ProjectCoverImage {
  fileName: 'cover.png';
}

export interface ProjectCounts {
  languages: number;
  visualLanguageCategories: number;
  visualLanguage: number;
  castMembers: number;
  locations: number;
  acts: number;
  sequences: number;
  scenes: number;
}

export interface ProjectCreateReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  coverPath: string | null;
  created: ProjectCounts;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}
