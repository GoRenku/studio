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
  LookbookSheet,
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
  SequenceSceneRow,
  SceneShotListResource,
  SceneStoryboardSheetReference,
  ActStoryboardResource,
  ActStoryboardSequence,
  ActStoryboardShot,
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
export type SceneNarrativeResourceResponse = SceneNarrativeResource;

export type SequenceSceneRowResponse = Omit<SequenceSceneRow, 'storyboardSheet'> & {
  storyboardSheet?: ScreenplayImageReferenceWithHttp;
};

export type SequenceResourceResponse = Omit<SequenceResource, 'scenes'> & {
  scenes: {
    items: SequenceSceneRowResponse[];
    nextCursor: string | null;
  };
};

export type SceneStoryboardSheetReferenceResponse = Omit<
  SceneStoryboardSheetReference,
  'sheet'
> & {
  sheet: ScreenplayImageReferenceWithHttp;
};

export type SceneShotListResourceResponse = Omit<
  SceneShotListResource,
  'storyboardSheet' | 'storyboardImagesByShotId'
> & {
  storyboardSheet: SceneStoryboardSheetReferenceResponse | null;
  storyboardImagesByShotId: Record<string, ScreenplayImageReferenceWithHttp>;
};

export type ActStoryboardShotResponse = Omit<ActStoryboardShot, 'image'> & {
  image: ScreenplayImageReferenceWithHttp | null;
};

export type ActStoryboardSequenceResponse = Omit<
  ActStoryboardSequence,
  'scenes'
> & {
  scenes: Array<{
    scene: ActStoryboardSequence['scenes'][number]['scene'];
    shots: ActStoryboardShotResponse[];
  }>;
};

export type ActStoryboardResourceResponse = Omit<
  ActStoryboardResource,
  'sequences'
> & {
  sequences: ActStoryboardSequenceResponse[];
};
export type InspirationResourceResponse = InspirationResource;
export type InspirationFolderResourceResponse = InspirationFolderResource;
export type InspirationFolderResponse = InspirationFolder;
export type LookbooksResourceResponse = LookbooksResource;
export type LookbookResourceResponse = LookbookResource;
export type LookbookResponse = Lookbook;
export type LookbookImageResponse = LookbookImage;
export type LookbookSheetResponse = LookbookSheet;

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
