import type {
  Project,
  ProjectLibrary,
  ProjectShell,
  ProjectSummary,
} from '@gorenku/studio-core/client';
import { projectCoverUrl } from './project-cover-url.js';

export type ProjectResponse = Project & {
  coverUrl: string | null;
};

export type ProjectShellResponse = ProjectShell & {
  coverUrl: string | null;
};

export interface ProjectLibraryResponse {
  storageRoot: string;
  projects: ProjectSummaryResponse[];
}

export type ProjectSummaryResponse = ProjectSummary & {
  coverUrl: string | null;
};

export function toProjectResponse(
  project: Project
): ProjectResponse {
  return {
    ...project,
    coverUrl: projectCoverUrl({
      projectName: project.projectName,
      coverImage: project.coverImage,
    }),
  };
}

export function toProjectShellResponse(project: ProjectShell): ProjectShellResponse {
  return {
    ...project,
    coverUrl: projectCoverUrl({
      projectName: project.project.projectName,
      coverImage: project.project.coverImage,
    }),
  };
}

export function toProjectLibraryResponse(
  library: ProjectLibrary
): ProjectLibraryResponse {
  return {
    storageRoot: library.storageRoot,
    projects: library.projects.map((project) => ({
      ...project,
      coverUrl: projectCoverUrl({
        projectName: project.projectName,
        coverImage: project.coverImage,
      }),
    })),
  };
}
