import type {
  Asset,
  ActStoryboardResource,
  ActStoryboardSequence,
  ActStoryboardBeat,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  SceneNarrativeResource,
  SceneBeatSheetResource,
  ScreenplayImageReference,
  ScreenplayImageReferenceWithHttp,
  SequenceResource,
  SequenceSceneRow,
  StoryArcResource,
} from '@gorenku/studio-core/client';

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

export type CastMemberResourceResponse = Omit<
  CastMemberResource,
  'firstImage' | 'voices'
> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
  voices: Array<
    Omit<CastMemberResource['voices'][number], 'sample'> & {
      sample: AssetWithHttpFiles;
    }
  >;
};

type AssetWithHttpFiles = Omit<Asset, 'files'> & {
  files: Array<Asset['files'][number] & { url: string }>;
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
export type SceneNarrativeResourceResponse = Omit<
  SceneNarrativeResource,
  'castMemberImages' | 'locationImages'
> & {
  castMemberImages: Record<string, ScreenplayImageReferenceWithHttp>;
  locationImages: Record<string, ScreenplayImageReferenceWithHttp>;
};

export type SequenceSceneRowResponse = Omit<SequenceSceneRow, 'storyboardPreview'> & {
  storyboardPreview?: {
    beatSheetId: string;
    images: Array<{
      beatId: string;
      image: ScreenplayImageReferenceWithHttp | null;
    }>;
  };
};

export type SequenceResourceResponse = Omit<SequenceResource, 'scenes'> & {
  scenes: {
    items: SequenceSceneRowResponse[];
    nextCursor: string | null;
  };
};

export type SceneBeatSheetResourceResponse = Omit<
  SceneBeatSheetResource,
  'storyboardImagesByBeatId' | 'castMemberImages'
> & {
  storyboardImagesByBeatId: Record<string, ScreenplayImageReferenceWithHttp>;
  castMemberImages: Record<string, ScreenplayImageReferenceWithHttp>;
};

export type ActStoryboardBeatResponse = Omit<ActStoryboardBeat, 'image'> & {
  image: ScreenplayImageReferenceWithHttp | null;
};

export type ActStoryboardSequenceResponse = Omit<
  ActStoryboardSequence,
  'scenes'
> & {
  scenes: Array<{
    scene: ActStoryboardSequence['scenes'][number]['scene'];
    beats: ActStoryboardBeatResponse[];
  }>;
};

export type ActStoryboardResourceResponse = Omit<
  ActStoryboardResource,
  'sequences'
> & {
  sequences: ActStoryboardSequenceResponse[];
};

export function toCastOverviewResourceResponse(
  projectName: string,
  resource: CastOverviewResource
): CastOverviewResourceResponse {
  return {
    cast: {
      ...resource.cast,
      items: resource.cast.items.map((castMember) => ({
        ...castMember,
        firstImage: castMember.firstImage
          ? withImageUrl(projectName, castMember.firstImage)
          : undefined,
      })),
    },
  };
}

export function toCastMemberResourceResponse(
  projectName: string,
  resource: CastMemberResource
): CastMemberResourceResponse {
  return {
    ...resource,
    firstImage: resource.firstImage
      ? withImageUrl(projectName, resource.firstImage)
      : undefined,
    voices: resource.voices.map((voice) => ({
      ...voice,
      sample: withAssetFileUrls(
        projectName,
        voice.sample
      ),
    })),
  };
}

export function toLocationOverviewResourceResponse(
  projectName: string,
  resource: LocationOverviewResource
): LocationOverviewResourceResponse {
  return {
    locations: {
      ...resource.locations,
      items: resource.locations.items.map((location) => ({
        ...location,
        firstImage: location.firstImage
          ? withImageUrl(projectName, location.firstImage)
          : undefined,
      })),
    },
  };
}

export function toLocationResourceResponse(
  projectName: string,
  resource: LocationResource
): LocationResourceResponse {
  return {
    ...resource,
    firstImage: resource.firstImage
      ? withImageUrl(projectName, resource.firstImage)
      : undefined,
  };
}

export function toSequenceResourceResponse(
  projectName: string,
  resource: SequenceResource
): SequenceResourceResponse {
  return {
    ...resource,
    scenes: {
      ...resource.scenes,
      items: resource.scenes.items.map((scene) => ({
        ...scene,
        storyboardPreview: scene.storyboardPreview
          ? {
              beatSheetId: scene.storyboardPreview.beatSheetId,
              images: scene.storyboardPreview.images.map((entry) => ({
                beatId: entry.beatId,
                image: entry.image
                  ? withImageUrl(projectName, entry.image)
                  : null,
              })),
            }
          : undefined,
      })),
    },
  };
}

export function toSceneBeatSheetResourceResponse(
  projectName: string,
  resource: SceneBeatSheetResource
): SceneBeatSheetResourceResponse {
  return {
    ...resource,
    storyboardImagesByBeatId: Object.fromEntries(
      Object.entries(resource.storyboardImagesByBeatId).map(([beatId, image]) => [
        beatId,
        withImageUrl(projectName, image),
      ])
    ),
    castMemberImages: Object.fromEntries(
      Object.entries(resource.castMemberImages).map(([castMemberId, image]) => [
        castMemberId,
        withImageUrl(projectName, image),
      ])
    ),
  };
}

export function toSceneNarrativeResourceResponse(
  projectName: string,
  resource: SceneNarrativeResource
): SceneNarrativeResourceResponse {
  return {
    ...resource,
    castMemberImages: Object.fromEntries(
      Object.entries(resource.castMemberImages).map(([castMemberId, image]) => [
        castMemberId,
        withImageUrl(projectName, image),
      ])
    ),
    locationImages: Object.fromEntries(
      Object.entries(resource.locationImages).map(([locationId, image]) => [
        locationId,
        withImageUrl(projectName, image),
      ])
    ),
  };
}

export function toActStoryboardResourceResponse(
  projectName: string,
  resource: ActStoryboardResource
): ActStoryboardResourceResponse {
  return {
    ...resource,
    sequences: resource.sequences.map((sequence) => ({
      ...sequence,
      scenes: sequence.scenes.map((scene) => ({
        scene: scene.scene,
        beats: scene.beats.map((beat) => ({
          ...beat,
          image: beat.image
            ? withImageUrl(projectName, beat.image)
            : null,
        })),
      })),
    })),
  };
}

function withImageUrl(
  projectName: string,
  image: ScreenplayImageReference
): ScreenplayImageReferenceWithHttp {
  return {
    ...image,
    url: `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(image.assetId)}/files/${encodeURIComponent(image.assetFileId)}`,
  };
}

function withAssetFileUrls(
  projectName: string,
  asset: Asset
): AssetWithHttpFiles {
  return {
    ...asset,
    files: asset.files.map((file) => ({
      ...file,
      url: `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(asset.id)}/files/${encodeURIComponent(file.id)}`,
    })),
  };
}
