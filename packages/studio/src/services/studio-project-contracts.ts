import type { Project, ProjectLibrary, ProjectSummary } from '@gorenku/studio-core';
import type { ProjectInformationUpdate } from '@gorenku/studio-core/node';

export type ProjectWithHttp = Project & {
  coverUrl: string | null;
};

export type ProjectSummaryWithHttp = ProjectSummary & {
  coverUrl: string | null;
};

export type ProjectLibraryWithHttp = Omit<ProjectLibrary, 'projects'> & {
  projects: ProjectSummaryWithHttp[];
};

export type ProjectInformationUpdateRequest = ProjectInformationUpdate;
