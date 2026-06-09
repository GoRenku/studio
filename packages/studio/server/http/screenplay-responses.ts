import type {
  Asset,
  ActStoryboardResource,
  ActStoryboardSequence,
  ActStoryboardShot,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  SceneNarrativeResource,
  SceneShotListResource,
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
export type SceneNarrativeResourceResponse = SceneNarrativeResource;

export type SequenceSceneRowResponse = Omit<SequenceSceneRow, 'storyboardPreview'> & {
  storyboardPreview?: {
    shotListId: string;
    images: Array<{
      shotId: string;
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

export type SceneShotListResourceResponse = Omit<
  SceneShotListResource,
  'storyboardImagesByShotId'
> & {
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
          ? withImageUrl(projectName, 'cast', castMember.id, castMember.firstImage)
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
      ? withImageUrl(projectName, 'cast', resource.castMember.id, resource.firstImage)
      : undefined,
    voices: resource.voices.map((voice) => ({
      ...voice,
      sample: withAssetFileUrls(
        projectName,
        'cast',
        resource.castMember.id,
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
          ? withImageUrl(projectName, 'locations', location.id, location.firstImage)
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
      ? withImageUrl(projectName, 'locations', resource.location.id, resource.firstImage)
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
              shotListId: scene.storyboardPreview.shotListId,
              images: scene.storyboardPreview.images.map((entry) => ({
                shotId: entry.shotId,
                image: entry.image
                  ? withSceneImageUrl(projectName, scene.id, entry.image)
                  : null,
              })),
            }
          : undefined,
      })),
    },
  };
}

export function toSceneShotListResourceResponse(
  projectName: string,
  resource: SceneShotListResource
): SceneShotListResourceResponse {
  const sceneId = resource.scene.id;
  return {
    ...resource,
    storyboardImagesByShotId: Object.fromEntries(
      Object.entries(resource.storyboardImagesByShotId).map(([shotId, image]) => [
        shotId,
        withSceneImageUrl(projectName, sceneId, image),
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
        shots: scene.shots.map((shot) => ({
          ...shot,
          image: shot.image
            ? withSceneImageUrl(projectName, scene.scene.id, shot.image)
            : null,
        })),
      })),
    })),
  };
}

function withImageUrl(
  projectName: string,
  ownerPath: 'cast' | 'locations',
  ownerId: string,
  image: ScreenplayImageReference
): ScreenplayImageReferenceWithHttp {
  return {
    ...image,
    url: `/studio-api/projects/${encodeURIComponent(projectName)}/${ownerPath}/${encodeURIComponent(ownerId)}/assets/${encodeURIComponent(image.assetId)}/files/${encodeURIComponent(image.assetFileId)}`,
  };
}

function withAssetFileUrls(
  projectName: string,
  ownerPath: 'cast' | 'locations',
  ownerId: string,
  asset: Asset
): AssetWithHttpFiles {
  return {
    ...asset,
    files: asset.files.map((file) => ({
      ...file,
      url: `/studio-api/projects/${encodeURIComponent(projectName)}/${ownerPath}/${encodeURIComponent(ownerId)}/assets/${encodeURIComponent(asset.assetId)}/files/${encodeURIComponent(file.id)}`,
    })),
  };
}

function withSceneImageUrl(
  projectName: string,
  sceneId: string,
  image: ScreenplayImageReference
): ScreenplayImageReferenceWithHttp {
  return {
    ...image,
    url: `/studio-api/projects/${encodeURIComponent(projectName)}/scenes/${encodeURIComponent(sceneId)}/assets/${encodeURIComponent(image.assetId)}/files/${encodeURIComponent(image.assetFileId)}`,
  };
}
