import type {
  ActStoryboardResource,
  ActStoryboardSequence,
  ActStoryboardBeat,
  SceneNarrativeResource,
  SceneBeatSheetResource,
  ScreenplayImageReference,
  ScreenplayImageReferenceWithHttp,
  SequenceResource,
  SequenceSceneRow,
  StoryArcResource,
} from '@gorenku/studio-core/client';

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
