import type { ProjectCoverImage } from '@gorenku/studio-core';

export function projectCoverUrl(input: {
  projectName: string;
  coverImage: ProjectCoverImage | null;
}): string | null {
  if (!input.coverImage) {
    return null;
  }
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/cover`;
}
