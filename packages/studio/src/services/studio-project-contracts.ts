import type {
  Asset,
  ActNavigationRow,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  CastDesignResource,
  InspirationFolder,
  InspirationFolderResource,
  InspirationResource,
  Lookbook,
  LookbookImage,
  LookbookResource,
  LookbooksResource,
  SceneDesignResource,
  SceneNarrativeResource,
  ScreenplayImageReferenceWithHttp,
  StudioSelection,
  StudioSelectionContextResult,
  PageResponse,
  ProductionExportSummary,
  ProjectInformationResource,
  ProjectLibrary,
  ProjectShell,
  ProjectSummary,
  SceneNavigationRow,
  SequenceNavigationRow,
  SequenceResource,
  StoryArcResource,
} from '@gorenku/studio-core/client';

export type ProjectShellWithHttp = ProjectShell & {
  coverUrl: string | null;
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

export type ProjectInformationResourceResponse = ProjectInformationResource;

export interface ProjectInformationLanguageUpdateRequest {
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export type ProductionExportSummaryResponse = ProductionExportSummary;

export type StudioAssetResponse = Asset;

export type CastDesignResourceResponse = CastDesignResource;

export type SceneDesignResourceResponse = SceneDesignResource;

export type CastOverviewResourceResponse = Omit<CastOverviewResource, 'cast'> & {
  cast: {
    items: Array<
      CastOverviewResource['cast']['items'][number] & {
        firstImage?: ScreenplayImageReferenceWithHttp;
      }
    >;
    nextCursor: string | null;
  };
};

export type CastMemberResourceResponse = Omit<CastMemberResource, 'firstImage'> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
};

export type LocationOverviewResourceResponse = Omit<
  LocationOverviewResource,
  'locations'
> & {
  locations: {
    items: Array<
      LocationOverviewResource['locations']['items'][number] & {
        firstImage?: ScreenplayImageReferenceWithHttp;
      }
    >;
    nextCursor: string | null;
  };
};

export type LocationResourceResponse = Omit<LocationResource, 'firstImage'> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
};

export type StoryArcResourceResponse = StoryArcResource;
export type SequenceResourceResponse = SequenceResource;
export type SceneNarrativeResourceResponse = SceneNarrativeResource;
export type InspirationResourceResponse = InspirationResource;
export type InspirationFolderResourceResponse = InspirationFolderResource;
export type InspirationFolderResponse = InspirationFolder;
export type LookbooksResourceResponse = LookbooksResource;
export type LookbookResourceResponse = LookbookResource;
export type LookbookResponse = Lookbook;
export type LookbookImageResponse = LookbookImage;

export type StudioPageResponse<T> = PageResponse<T>;

export type SequenceNavigationPageResponse =
  StudioPageResponse<SequenceNavigationRow>;
export type ActNavigationPageResponse = StudioPageResponse<ActNavigationRow>;

export type SceneNavigationPageResponse = StudioPageResponse<SceneNavigationRow>;

export type StudioSelectionContextRequest = {
  selection: StudioSelection;
};

export type StudioSelectionContextResponse =
  StudioSelectionContextResult;
