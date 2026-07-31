import type {
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  PropOverviewResource,
  PropResource,
  ScreenplayImageReference,
  ScreenplayImageReferenceWithHttp,
} from '@gorenku/studio-core/client';
import {
  toStudioAssetResponse,
  type StudioAssetResponse,
} from './asset-responses.js';

export type CastOverviewResourceResponse = Omit<CastOverviewResource, 'cast'> & {
  cast: {
    items: Array<CastOverviewResource['cast']['items'][number] & {
      firstImage?: ScreenplayImageReferenceWithHttp;
    }>;
    nextCursor: string | null;
  };
};

export type CastMemberResourceResponse = Omit<
  CastMemberResource,
  'firstImage' | 'voices'
> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
  voices: Array<Omit<CastMemberResource['voices'][number], 'sample'> & {
    sample: StudioAssetResponse;
  }>;
};

export type LocationOverviewResourceResponse = Omit<
  LocationOverviewResource,
  'locations'
> & {
  locations: {
    items: Array<LocationOverviewResource['locations']['items'][number] & {
      firstImage?: ScreenplayImageReferenceWithHttp;
    }>;
    nextCursor: string | null;
  };
};

export type LocationResourceResponse = Omit<LocationResource, 'firstImage'> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
};

export type PropOverviewResourceResponse = Omit<PropOverviewResource, 'props'> & {
  props: {
    items: Array<PropOverviewResource['props']['items'][number] & {
      firstImage?: ScreenplayImageReferenceWithHttp;
    }>;
    nextCursor: string | null;
  };
};

export type PropResourceResponse = Omit<PropResource, 'firstImage'> & {
  firstImage?: ScreenplayImageReferenceWithHttp;
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
        firstImage: withOptionalImageUrl(projectName, castMember.firstImage),
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
    firstImage: withOptionalImageUrl(projectName, resource.firstImage),
    voices: resource.voices.map((voice) => ({
      ...voice,
      sample: toStudioAssetResponse(projectName, voice.sample),
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
        firstImage: withOptionalImageUrl(projectName, location.firstImage),
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
    firstImage: withOptionalImageUrl(projectName, resource.firstImage),
  };
}

export function toPropOverviewResourceResponse(
  projectName: string,
  resource: PropOverviewResource
): PropOverviewResourceResponse {
  return {
    props: {
      ...resource.props,
      items: resource.props.items.map((prop) => ({
        ...prop,
        firstImage: withOptionalImageUrl(projectName, prop.firstImage),
      })),
    },
  };
}

export function toPropResourceResponse(
  projectName: string,
  resource: PropResource
): PropResourceResponse {
  return {
    ...resource,
    firstImage: withOptionalImageUrl(projectName, resource.firstImage),
  };
}

function withOptionalImageUrl(
  projectName: string,
  image: ScreenplayImageReference | undefined
): ScreenplayImageReferenceWithHttp | undefined {
  return image
    ? {
        ...image,
        url: assetFileUrl(projectName, image.assetId, image.assetFileId),
      }
    : undefined;
}

function assetFileUrl(
  projectName: string,
  assetId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}
