import type {
  SceneBeatsResource,
  ScreenplayImageReference,
  ScreenplayImageReferenceWithHttp,
} from '@gorenku/studio-core/client';

export type SceneBeatsResourceResponse = Omit<
  SceneBeatsResource,
  'storyboardImagesByBeatId' | 'castMemberImages'
> & {
  storyboardImagesByBeatId: Record<string, ScreenplayImageReferenceWithHttp>;
  castMemberImages: Record<string, ScreenplayImageReferenceWithHttp>;
};

export function toSceneBeatsResourceResponse(
  projectName: string,
  resource: SceneBeatsResource,
): SceneBeatsResourceResponse {
  return {
    ...resource,
    storyboardImagesByBeatId: Object.fromEntries(
      Object.entries(resource.storyboardImagesByBeatId).map(([beatId, image]) => [beatId, withImageUrl(projectName, image)]),
    ),
    castMemberImages: Object.fromEntries(
      Object.entries(resource.castMemberImages).map(([castMemberId, image]) => [castMemberId, withImageUrl(projectName, image)]),
    ),
  };
}

function withImageUrl(projectName: string, image: ScreenplayImageReference): ScreenplayImageReferenceWithHttp {
  return {
    ...image,
    url: `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(image.assetId)}/files/${encodeURIComponent(image.assetFileId)}`,
  };
}
