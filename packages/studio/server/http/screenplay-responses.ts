import type {
  ActStoryboardResource,
  ActStoryboardSequence,
  ActStoryboardShot,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  SceneNarrativeResource,
  SceneShotListResource,
  SceneStoryboardSheetReference,
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
        storyboardSheet: scene.storyboardSheet
          ? withSceneImageUrl(projectName, scene.id, scene.storyboardSheet)
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
    storyboardSheet: resource.storyboardSheet
      ? {
          ...resource.storyboardSheet,
          sheet: withSceneImageUrl(
            projectName,
            sceneId,
            resource.storyboardSheet.sheet
          ),
        }
      : null,
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
