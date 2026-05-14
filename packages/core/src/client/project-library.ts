import type {
  ProjectCounts,
  ProjectCoverImage,
  ProjectType,
} from './project.js';
import type { ProjectDataError } from './diagnostics.js';

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
  counts: ProjectCounts | null;
  validationError: ProjectDataError | null;
}
