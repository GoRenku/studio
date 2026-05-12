import type {
  Asset,
  Project,
  ProjectLibrary,
  ProjectSummary,
} from '@gorenku/studio-core';
import { projectCoverUrl } from './project-cover-url.js';

export type ProjectResponse = Project & {
  coverUrl: string | null;
  castAssetsByCastMemberId?: Record<string, Asset[]>;
};

export interface ProjectLibraryResponse {
  storageRoot: string;
  projects: ProjectSummaryResponse[];
}

export type ProjectSummaryResponse = ProjectSummary & {
  coverUrl: string | null;
};

export function toProjectResponse(
  project: Project,
  options: { castAssets?: Asset[] } = {}
): ProjectResponse {
  return {
    ...project,
    coverUrl: projectCoverUrl({
      projectName: project.identity.name,
      coverImage: project.coverImage,
    }),
    castAssetsByCastMemberId: groupCastAssetsByCastMemberId(
      options.castAssets ?? []
    ),
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

function groupCastAssetsByCastMemberId(
  assets: Asset[]
): Record<string, Asset[]> {
  const grouped: Record<string, Asset[]> = {};
  for (const asset of assets) {
    if (asset.target.kind !== 'castMember') {
      continue;
    }
    grouped[asset.target.castMemberId] ??= [];
    grouped[asset.target.castMemberId]!.push(asset);
  }
  return grouped;
}
