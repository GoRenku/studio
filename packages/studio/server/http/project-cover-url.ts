import type { ProjectCoverImage } from '@gorenku/studio-core/client';

export function projectCoverUrl(input: {
  projectName: string;
  coverImage: ProjectCoverImage | null;
}): string | null {
  if (!input.coverImage) {
    return null;
  }
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/cover`;
}
