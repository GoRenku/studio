import type {
  CastMember,
  Clip,
  Project,
  ProjectLibrary,
  ProjectSummary,
  Scene,
  Sequence,
} from '@gorenku/studio-core';

export type {
  CastMember,
  Clip,
  Project,
  ProjectLibrary,
  ProjectSummary,
  Scene,
  Sequence,
};

export type ProjectWithHttp = Project & {
  coverUrl: string | null;
};

export type ProjectSummaryWithHttp = ProjectSummary & {
  coverUrl: string | null;
};

export type ProjectLibraryWithHttp = Omit<ProjectLibrary, 'projects'> & {
  projects: ProjectSummaryWithHttp[];
};

export type Selection =
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'clip'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };
