import { fireEvent } from '@testing-library/react';

interface Size {
  width: number;
  height: number;
}

/**
 * jsdom has no layout: gives every element the stage size, every image the natural size, and a
 * no-op ResizeObserver, so zoomable images can measure themselves. Returns a restore function.
 */
export function stubImageZoomLayout(stage: Size, image: Size): () => void {
  const restores = [
    stubGetter(HTMLElement.prototype, 'clientWidth', stage.width),
    stubGetter(HTMLElement.prototype, 'clientHeight', stage.height),
    stubGetter(HTMLImageElement.prototype, 'naturalWidth', image.width),
    stubGetter(HTMLImageElement.prototype, 'naturalHeight', image.height),
  ];
  const restoreResizeObserver = stubResizeObserver();
  return () => {
    restores.forEach((restore) => restore());
    restoreResizeObserver();
  };
}

/** jsdom has no ResizeObserver; zoomable images in the shared image preview need one to mount. */
export function stubResizeObserver(): () => void {
  const resizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  return () => {
    globalThis.ResizeObserver = resizeObserver;
  };
}

/** Fires load on every rendered image so zoomable images read their natural size. */
export function loadRenderedImages(): void {
  document.querySelectorAll('img').forEach((image) => fireEvent.load(image));
}

function stubGetter(target: object, property: string, value: number): () => void {
  const original = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, get: () => value });
  return () => {
    if (original) Object.defineProperty(target, property, original);
  };
}
