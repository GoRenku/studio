import type {
  Project,
  ProjectLibrary,
  ProjectSummary,
} from '@gorenku/studio-core';
import { projectCoverUrl } from './project-cover-url.js';

export type ProjectResponse = Project & {
  coverUrl: string | null;
};

export interface ProjectLibraryResponse {
  storageRoot: string;
  projects: ProjectSummaryResponse[];
}

export type ProjectSummaryResponse = ProjectSummary & {
  coverUrl: string | null;
};

export function toProjectResponse(project: Project): ProjectResponse {
  return {
    ...project,
    coverUrl: projectCoverUrl({
      projectName: project.identity.name,
      coverImage: project.coverImage,
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
        projectName: project.name,
        coverImage: project.coverImage,
      }),
    })),
  };
}
