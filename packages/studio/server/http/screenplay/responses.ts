import type {
  SceneBeatSheetResource,
  ScreenplayImageReference,
  ScreenplayImageReferenceWithHttp,
} from '@gorenku/studio-core/client';

export type SceneBeatSheetResourceResponse = Omit<
  SceneBeatSheetResource,
  'storyboardImagesByBeatId' | 'castMemberImages'
> & {
  storyboardImagesByBeatId: Record<string, ScreenplayImageReferenceWithHttp>;
  castMemberImages: Record<string, ScreenplayImageReferenceWithHttp>;
};

export function toSceneBeatSheetResourceResponse(
  projectName: string,
  resource: SceneBeatSheetResource,
): SceneBeatSheetResourceResponse {
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
