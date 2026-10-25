import { useCallback, useMemo, useState } from 'react';

/**
 * What part of an image is on screen, independent of the image's pixel size.
 * `zoom` is a multiple of the fitted size (1 shows the whole image) and the
 * center is a fraction of the image width and height, so two images of
 * different sizes can share one view and show the same spot.
 */
export interface ImageZoomView {
  zoom: number;
  centerX: number;
  centerY: number;
}

/** The stage an image is shown in and the image's natural pixel size. */
export interface ImageZoomLayout {
  stageWidth: number;
  stageHeight: number;
  imageWidth: number;
  imageHeight: number;
}

export interface ImageZoomTransform {
  x: number;
  y: number;
  scale: number;
}

export const FIT_IMAGE_ZOOM_VIEW: ImageZoomView = { zoom: 1, centerX: 0.5, centerY: 0.5 };

/** The closest an image can be inspected: eight screen pixels per image pixel. */
const MAX_PIXEL_SCALE = 8;
const ZOOM_STEP = 1.5;

export function fitScale(layout: ImageZoomLayout): number {
  return Math.min(layout.stageWidth / layout.imageWidth, layout.stageHeight / layout.imageHeight);
}

export function maxZoom(layout: ImageZoomLayout): number {
  return Math.max(1, MAX_PIXEL_SCALE / fitScale(layout));
}

export function isZoomedIn(view: ImageZoomView): boolean {
  return view.zoom > 1.001;
}

/** Keeps the zoom in range and the image covering the stage wherever it is larger than the stage. */
export function clampImageZoomView(view: ImageZoomView, layout: ImageZoomLayout): ImageZoomView {
  const zoom = Math.min(maxZoom(layout), Math.max(1, view.zoom));
  const scale = fitScale(layout) * zoom;
  return {
    zoom,
    centerX: clampCenter(view.centerX, layout.stageWidth / (layout.imageWidth * scale)),
    centerY: clampCenter(view.centerY, layout.stageHeight / (layout.imageHeight * scale)),
  };
}

export function imageZoomTransform(view: ImageZoomView, layout: ImageZoomLayout): ImageZoomTransform {
  const clamped = clampImageZoomView(view, layout);
  const scale = fitScale(layout) * clamped.zoom;
  return {
    scale,
    x: layout.stageWidth / 2 - clamped.centerX * layout.imageWidth * scale,
    y: layout.stageHeight / 2 - clamped.centerY * layout.imageHeight * scale,
  };
}

/** Zooms to `zoom` while keeping the image point under `anchor` (stage pixels) in place; the stage center by default. */
export function zoomImageAt(
  view: ImageZoomView,
  layout: ImageZoomLayout,
  zoom: number,
  anchor?: { x: number; y: number }
): ImageZoomView {
  const from = imageZoomTransform(view, layout);
  const nextZoom = Math.min(maxZoom(layout), Math.max(1, zoom));
  const scale = fitScale(layout) * nextZoom;
  const point = anchor ?? { x: layout.stageWidth / 2, y: layout.stageHeight / 2 };
  const imageX = (point.x - from.x) / from.scale;
  const imageY = (point.y - from.y) / from.scale;
  return clampImageZoomView({
    zoom: nextZoom,
    centerX: (imageX + (layout.stageWidth / 2 - point.x) / scale) / layout.imageWidth,
    centerY: (imageY + (layout.stageHeight / 2 - point.y) / scale) / layout.imageHeight,
  }, layout);
}

/** Moves the image by a drag of `dx`, `dy` stage pixels. */
export function panImage(view: ImageZoomView, layout: ImageZoomLayout, dx: number, dy: number): ImageZoomView {
  const scale = fitScale(layout) * view.zoom;
  return clampImageZoomView({
    zoom: view.zoom,
    centerX: view.centerX - dx / (layout.imageWidth * scale),
    centerY: view.centerY - dy / (layout.imageHeight * scale),
  }, layout);
}

export function zoomImageIn(view: ImageZoomView, layout: ImageZoomLayout): ImageZoomView {
  return zoomImageAt(view, layout, view.zoom * ZOOM_STEP);
}

export function zoomImageOut(view: ImageZoomView, layout: ImageZoomLayout): ImageZoomView {
  return zoomImageAt(view, layout, view.zoom / ZOOM_STEP);
}

/** One image pixel per screen pixel, or fit when the fitted image is already that large. */
export function showActualPixels(view: ImageZoomView, layout: ImageZoomLayout): ImageZoomView {
  return zoomImageAt(view, layout, 1 / fitScale(layout));
}

/** "Fit" while the whole image shows, otherwise the screen size of one image pixel as a percentage. */
export function imageZoomLabel(view: ImageZoomView, layout: ImageZoomLayout | null): string {
  if (!layout || !isZoomedIn(view)) return 'Fit';
  return `${Math.round(fitScale(layout) * view.zoom * 100)}%`;
}

export function sameImageZoomLayout(a: ImageZoomLayout | null, b: ImageZoomLayout): boolean {
  return a !== null
    && a.stageWidth === b.stageWidth
    && a.stageHeight === b.stageHeight
    && a.imageWidth === b.imageWidth
    && a.imageHeight === b.imageHeight;
}

/** The view and measured layout of one zoomable image, with the zoom bar and keyboard commands. */
export function useImageZoom() {
  const [view, setView] = useState<ImageZoomView>(FIT_IMAGE_ZOOM_VIEW);
  const [layout, setLayout] = useState<ImageZoomLayout | null>(null);
  const withLayout = useCallback(
    (change: (current: ImageZoomView, measured: ImageZoomLayout) => ImageZoomView) => {
      if (layout) setView((current) => change(current, layout));
    },
    [layout]
  );
  const reset = useCallback(() => setView(FIT_IMAGE_ZOOM_VIEW), []);
  const zoomIn = useCallback(() => withLayout(zoomImageIn), [withLayout]);
  const zoomOut = useCallback(() => withLayout(zoomImageOut), [withLayout]);
  const actualPixels = useCallback(() => withLayout(showActualPixels), [withLayout]);
  const onLayoutChange = useCallback((next: ImageZoomLayout) => {
    setLayout((current) => (sameImageZoomLayout(current, next) ? current : next));
  }, []);
  return useMemo(() => ({
    view,
    layout,
    label: imageZoomLabel(view, layout),
    zoomedIn: isZoomedIn(view),
    canZoomIn: layout !== null && view.zoom < maxZoom(layout) - 0.001,
    onViewChange: setView,
    onLayoutChange,
    reset,
    zoomIn,
    zoomOut,
    actualPixels,
  }), [view, layout, onLayoutChange, reset, zoomIn, zoomOut, actualPixels]);
}

export type ImageZoom = ReturnType<typeof useImageZoom>;

/** Handles the zoom keys: + and - step, 0 fits, 1 shows actual pixels. Returns whether the key was a zoom key. */
export function handleImageZoomKey(key: string, zoom: Pick<ImageZoom, 'zoomIn' | 'zoomOut' | 'reset' | 'actualPixels'>): boolean {
  const command = IMAGE_ZOOM_KEYS[key];
  if (!command) return false;
  zoom[command]();
  return true;
}

const IMAGE_ZOOM_KEYS: Record<string, 'zoomIn' | 'zoomOut' | 'reset' | 'actualPixels'> = {
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  '0': 'reset',
  '1': 'actualPixels',
};

function clampCenter(center: number, visibleFraction: number): number {
  if (visibleFraction >= 1) return 0.5;
  const half = visibleFraction / 2;
  return Math.min(1 - half, Math.max(half, center));
}
