import type {
  ProjectCounts,
  ProjectCoverImage,
} from './project/index.js';
import type { ProjectDataError } from './diagnostics.js';

export interface ProjectLibrary {
  storageRoot: string;
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  projectName: string;
  title: string;
  folderPath: string;
  coverImage: ProjectCoverImage | null;
  logline?: string;
  counts: ProjectCounts | null;
  validationError: ProjectDataError | null;
}
