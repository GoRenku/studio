import type {
  Asset,
  ProductionExportSummary,
  Project,
  ProjectLibrary,
  ProjectSummary,
} from '@gorenku/studio-core';

export type ProjectWithHttp = Project & {
  coverUrl: string | null;
  castAssetsByCastMemberId?: Record<string, Asset[]>;
};

export type ProjectSummaryWithHttp = ProjectSummary & {
  coverUrl: string | null;
};

export type ProjectLibraryWithHttp = Omit<ProjectLibrary, 'projects'> & {
  projects: ProjectSummaryWithHttp[];
};

export interface ProjectInformationUpdateRequest {
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string | null;
  languages: ProjectInformationLanguageUpdateRequest[];
}

export interface ProjectInformationLanguageUpdateRequest {
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export type ProductionExportSummaryResponse = ProductionExportSummary;

export type StudioAssetResponse = Asset;
