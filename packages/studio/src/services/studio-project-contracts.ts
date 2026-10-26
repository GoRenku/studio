import type {
  AssetFile,
  CastCastingResource,
  CastingRoundView,
  CastMemberCharacterArcResource,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  PropOverviewResource,
  PropResource,
  InspirationFolder,
  InspirationFolderResource,
  InspirationResource,
  Lookbook,
  LookbookImage,
  LookbookResource,
  LookbookSheet,
  ProjectLookbooksResource,
  SceneDesignResource,
  ScreenplayImageReferenceWithHttp,
  StudioSelection,
  StudioSelectionContextResult,
  PageResponse,
  ProjectInformationResource,
  ProjectSettingsResource,
  ProjectLibrary,
  ProjectShell,
  ProjectSummary,
  SceneBeatsResource,
  ScreenplayBeatGalleryResource,
  ScreenplaySceneResource,
  ScreenplaySectionResource,
  ScreenplayStructureResource,
  StoryArcResource,
} from '@gorenku/studio-core/client';

export type ProjectShellWithHttp = ProjectShell & {
  coverUrl: string | null;
  storageRoot: string;
};

export type ProjectSummaryWithHttp = ProjectSummary & {
  coverUrl: string | null;
};

export type ProjectLibraryWithHttp = Omit<ProjectLibrary, 'projects'> & {
  projects: ProjectSummaryWithHttp[];
};

export type ProjectInformationResourceResponse = ProjectInformationResource;
export type ProjectSettingsResourceResponse = ProjectSettingsResource;

export interface StudioAssetFileResponse
  extends Omit<AssetFile, 'projectRelativePath'> {
  url: string;
}



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

export type CastMemberCharacterArcResourceResponse = Omit<CastMemberCharacterArcResource, 'characterSheets'> & {
  characterSheets: StudioAssetFileResponse[];
};

export type CastingRoundViewResponse = Omit<CastingRoundView, 'candidates'> & {
  candidates: Array<Omit<CastingRoundView['candidates'][number], 'assetFile'> & {
    assetFile: StudioAssetFileResponse;
  }>;
};

export type CastCastingLookResponse = Omit<CastCastingResource['looks'][number], 'rounds' | 'castCandidate'> & {
  rounds: CastingRoundViewResponse[];
  castCandidate: StudioAssetFileResponse | null;
};

export type CastCastingCostumeResponse = Omit<CastCastingResource['costumes'][number], 'rounds'> & {
  rounds: CastingRoundViewResponse[];
};

export type CastCastingResourceResponse = Omit<CastCastingResource, 'looks' | 'costumes'> & {
  looks: CastCastingLookResponse[];
  costumes: CastCastingCostumeResponse[];
};

export type CastMemberResourceResponse = Omit<
  CastMemberResource,
  'firstImage' | 'voices'
> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
  voices: Array<
    Omit<CastMemberResource['voices'][number], 'sample'> & {
      sample: StudioAssetFileResponse;
    }
  >;
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

export type LocationResourceResponse = Omit<
  LocationResource,
  'firstImage' | 'selectedWorld'
> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
  selectedWorld: StudioAssetFileResponse | null;
};

export type PropOverviewResourceResponse = Omit<PropOverviewResource, 'props'> & {
  props: {
    items: Array<
      PropOverviewResource['props']['items'][number] & {
        firstImage?: ScreenplayImageReferenceWithHttp;
      }
    >;
    nextCursor: string | null;
  };
};

export type PropResourceResponse = Omit<PropResource, 'firstImage'> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
};

export type StoryArcResourceResponse = StoryArcResource;
export type ScreenplayStructureResourceResponse = ScreenplayStructureResource;
export type ScreenplaySectionResourceResponse = ScreenplaySectionResource;
export type ScreenplaySceneResourceResponse = ScreenplaySceneResource;

export type SceneBeatsResourceResponse = Omit<
  SceneBeatsResource,
  'storyboardImagesByBeatId' | 'castMemberImages'
> & {
  storyboardImagesByBeatId: Record<string, ScreenplayImageReferenceWithHttp>;
  castMemberImages: Record<string, ScreenplayImageReferenceWithHttp>;
};

export type ScreenplayBeatGalleryResourceResponse = Omit<
  ScreenplayBeatGalleryResource,
  'scenes'
> & {
  scenes: Array<
    Omit<ScreenplayBeatGalleryResource['scenes'][number], 'beats'> & {
      beats: Array<
        Omit<
          ScreenplayBeatGalleryResource['scenes'][number]['beats'][number],
          'image'
        > & {
          image: ScreenplayImageReferenceWithHttp;
        }
      >;
    }
  >;
};

export type InspirationResourceResponse = InspirationResource;
export type InspirationFolderResourceResponse = InspirationFolderResource;
export type InspirationFolderResponse = InspirationFolder;
export type ProjectLookbooksResourceResponse = ProjectLookbooksResource;
export type LookbookResourceResponse = LookbookResource;
export type LookbookResponse = Lookbook;
export type LookbookImageResponse = LookbookImage;
export type LookbookSheetResponse = LookbookSheet;

export type StudioPageResponse<T> = PageResponse<T>;

export type StudioSelectionContextRequest = {
  selection: StudioSelection;
};

export type StudioSelectionContextResponse =
  StudioSelectionContextResult;
