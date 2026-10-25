import { describe, expect, it } from 'vitest';
import {
  FIT_IMAGE_ZOOM_VIEW,
  clampImageZoomView,
  imageZoomLabel,
  imageZoomTransform,
  maxZoom,
  panImage,
  showActualPixels,
  zoomImageAt,
  zoomImageIn,
  zoomImageOut,
  type ImageZoomLayout,
} from './image-zoom';

// A 2000×1000 image in a 1000×800 stage fits at half size, letterboxed top and bottom.
const layout: ImageZoomLayout = { stageWidth: 1000, stageHeight: 800, imageWidth: 2000, imageHeight: 1000 };

describe('image zoom', () => {
  it('fits and centers the whole image at zoom 1', () => {
    expect(imageZoomTransform(FIT_IMAGE_ZOOM_VIEW, layout)).toEqual({ scale: 0.5, x: 0, y: 150 });
    expect(imageZoomLabel(FIT_IMAGE_ZOOM_VIEW, layout)).toBe('Fit');
  });

  it('keeps the image point under the pointer in place while zooming', () => {
    const anchor = { x: 250, y: 400 };
    const before = imageZoomTransform(FIT_IMAGE_ZOOM_VIEW, layout);
    const imagePoint = { x: (anchor.x - before.x) / before.scale, y: (anchor.y - before.y) / before.scale };
    const view = zoomImageAt(FIT_IMAGE_ZOOM_VIEW, layout, 4, anchor);
    const after = imageZoomTransform(view, layout);

    expect(after.scale).toBe(2);
    expect(imagePoint.x * after.scale + after.x).toBeCloseTo(anchor.x);
    expect(imagePoint.y * after.scale + after.y).toBeCloseTo(anchor.y);
  });

  it('steps in and out from the center and never below fit or past eight screen pixels per image pixel', () => {
    const zoomedIn = zoomImageIn(FIT_IMAGE_ZOOM_VIEW, layout);
    expect(zoomedIn.zoom).toBe(1.5);
    expect(zoomImageOut(zoomImageOut(zoomedIn, layout), layout)).toEqual(FIT_IMAGE_ZOOM_VIEW);
    expect(maxZoom(layout)).toBe(16);
    expect(zoomImageAt(FIT_IMAGE_ZOOM_VIEW, layout, 100).zoom).toBe(16);
  });

  it('shows actual pixels and labels the zoom as screen size per image pixel', () => {
    const view = showActualPixels(FIT_IMAGE_ZOOM_VIEW, layout);
    expect(imageZoomTransform(view, layout).scale).toBe(1);
    expect(imageZoomLabel(view, layout)).toBe('100%');
    expect(imageZoomLabel(zoomImageIn(FIT_IMAGE_ZOOM_VIEW, layout), layout)).toBe('75%');
  });

  it('pans while zoomed but keeps the image covering the stage', () => {
    const view = zoomImageAt(FIT_IMAGE_ZOOM_VIEW, layout, 4);
    const moved = panImage(view, layout, -100, 0);
    expect(imageZoomTransform(moved, layout).x).toBeCloseTo(imageZoomTransform(view, layout).x - 100);

    const farLeft = imageZoomTransform(panImage(view, layout, 100000, 100000), layout);
    expect(farLeft).toEqual({ scale: 2, x: 0, y: 0 });
    expect(panImage(FIT_IMAGE_ZOOM_VIEW, layout, 300, 300)).toEqual(FIT_IMAGE_ZOOM_VIEW);
  });

  it('clamps a shared view to each image, so a view taken from another image still fits', () => {
    const square: ImageZoomLayout = { stageWidth: 400, stageHeight: 400, imageWidth: 400, imageHeight: 400 };
    expect(clampImageZoomView({ zoom: 2, centerX: 0, centerY: 1 }, square)).toEqual({ zoom: 2, centerX: 0.25, centerY: 0.75 });
  });
});
