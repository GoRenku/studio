import {
  useCallback,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from 'react';

export function imageAspectRatioFromDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
  fallbackAspectRatio: number
): number {
  if (width && height && width > 0 && height > 0) {
    return width / height;
  }
  return fallbackAspectRatio;
}

export function imageAspectRatioFromString(
  value: string | null | undefined,
  fallbackAspectRatio = 16 / 9
): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(
    value ?? ''
  );
  if (!match) {
    return normalizeAspectRatio(fallbackAspectRatio);
  }
  return normalizeAspectRatio(Number(match[1]) / Number(match[2]));
}

export function useImageAspectRatio(
  initialAspectRatio: number,
  imageKey: string | null = null
) {
  const normalizedInitialAspectRatio = normalizeAspectRatio(initialAspectRatio);
  const [measuredImage, setMeasuredImage] = useState<{
    key: string | null;
    aspectRatio: number;
  } | null>(null);
  const aspectRatio =
    measuredImage?.key === imageKey
      ? measuredImage.aspectRatio
      : normalizedInitialAspectRatio;

  const onImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalHeight, naturalWidth } = event.currentTarget;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setMeasuredImage({
          key: imageKey,
          aspectRatio: naturalWidth / naturalHeight,
        });
      }
    },
    [imageKey]
  );

  return {
    aspectRatio,
    aspectRatioStyle: { aspectRatio } satisfies CSSProperties,
    onImageLoad,
  };
}

function normalizeAspectRatio(aspectRatio: number): number {
  return Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
}
