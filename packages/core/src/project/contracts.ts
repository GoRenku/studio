export type ProjectType = 'standaloneMovie' | 'series';

export interface Project {
  identity: ProjectIdentity;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  episodes: Episode[];
  sequences: Sequence[];
  counts: ProjectCounts;
}

export interface ProjectLibrary {
  storageRoot: string;
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  coverImage: ProjectCoverImage | null;
  logline?: string;
  format?: string;
  baseLanguage?: string;
  counts: ProjectCounts | null;
  validationError: ProjectDataError | null;
}

export interface ProjectIdentity {
  id: string;
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  databasePath: string;
  format?: string;
  baseLanguage?: string;
  aspectRatio?: string;
  resolution?: {
    width: number;
    height: number;
  };
  logline?: string;
  summary?: string;
}

export interface ProjectCoverImage {
  fileName: 'cover.png';
}

export interface ProjectLanguage {
  id: string;
  localeTag: string;
  displayName?: string;
  isBase: boolean;
}

export interface VisualLanguage {
  id: string;
  name: string;
  intent?: string;
  summary?: string;
}

export interface CastMember {
  id: string;
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
}

export interface Episode {
  id: string;
  title: string;
  shortTitle?: string;
  summary?: string;
  sequences: Sequence[];
}

export interface Sequence {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  summary?: string;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  title: string;
  summary?: string;
  clips: Clip[];
}

export interface Clip {
  id: string;
  title: string;
  summary?: string;
  visualIntent?: string;
}

export interface ProjectCounts {
  languages: number;
  visualLanguage: number;
  castMembers: number;
  episodes: number;
  sequences: number;
  scenes: number;
  clips: number;
}

export interface ProjectDataError {
  code: string;
  message: string;
}

export interface ProjectCreateReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  coverPath: string | null;
  created: ProjectCounts;
}
