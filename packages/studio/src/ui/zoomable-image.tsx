import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react';
import { cn } from '@/lib/utils';
import {
  FIT_IMAGE_ZOOM_VIEW,
  imageZoomTransform,
  isZoomedIn,
  panImage,
  zoomImageAt,
  type ImageZoomLayout,
  type ImageZoomView,
} from '@/ui/image-zoom';

interface ZoomableImageProps {
  src: string;
  alt: string;
  view: ImageZoomView;
  onViewChange: (view: ImageZoomView) => void;
  /** Reports the measured stage and image size, which the zoom bar needs for its steps and label. */
  onLayoutChange?: (layout: ImageZoomLayout) => void;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  className?: string;
}

interface StageSize {
  width: number;
  height: number;
}

interface ImageSize {
  src: string;
  width: number;
  height: number;
}

type StagePoint = { x: number; y: number };

/** Wheel speed for a mouse wheel; trackpad pinch arrives as ctrl+wheel with small deltas and gets a larger factor. */
const WHEEL_ZOOM_SPEED = 0.0025;
const PINCH_WHEEL_ZOOM_SPEED = 0.01;
const DOUBLE_CLICK_ZOOM = 2.5;

/**
 * An image that zooms toward the pointer with the wheel or a pinch, pans when dragged, and
 * toggles between fit and a close view on double-click. The view is controlled by the caller.
 */
export function ZoomableImage({ src, alt, view, onViewChange, onLayoutChange, onLoad, className }: ZoomableImageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<StageSize | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, StagePoint>());
  const gesture = useRef<{ kind: 'pan'; last: StagePoint } | { kind: 'pinch'; distance: number; zoom: number } | null>(null);

  const layout = useMemo<ImageZoomLayout | null>(() => {
    if (!stageSize || !imageSize || imageSize.src !== src) return null;
    if (stageSize.width <= 0 || stageSize.height <= 0 || imageSize.width <= 0 || imageSize.height <= 0) return null;
    return { stageWidth: stageSize.width, stageHeight: stageSize.height, imageWidth: imageSize.width, imageHeight: imageSize.height };
  }, [imageSize, src, stageSize]);

  const latest = useRef({ view, layout, onViewChange });
  useLayoutEffect(() => {
    latest.current = { view, layout, onViewChange };
  });

  useLayoutEffect(() => {
    const stage = stageRef.current!;
    const measure = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (layout) onLayoutChange?.(layout);
  }, [layout, onLayoutChange]);

  useEffect(() => {
    const stage = stageRef.current!;
    const handleWheel = (event: WheelEvent) => {
      const current = latest.current;
      if (!current.layout) return;
      event.preventDefault();
      const speed = event.ctrlKey ? PINCH_WHEEL_ZOOM_SPEED : WHEEL_ZOOM_SPEED;
      const zoom = current.view.zoom * Math.exp(-event.deltaY * speed);
      current.onViewChange(zoomImageAt(current.view, current.layout, zoom, stagePoint(stage, event)));
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layout) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, stagePoint(event.currentTarget, event));
    const [first, second] = [...pointers.current.values()];
    if (first && second) {
      gesture.current = { kind: 'pinch', distance: distanceBetween(first, second), zoom: view.zoom };
    } else if (first) {
      gesture.current = { kind: 'pan', last: first };
      setDragging(true);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layout || !pointers.current.has(event.pointerId)) return;
    const point = stagePoint(event.currentTarget, event);
    pointers.current.set(event.pointerId, point);
    const active = gesture.current;
    if (active?.kind === 'pinch') {
      const [first, second] = [...pointers.current.values()];
      if (!first || !second) return;
      const zoom = active.zoom * (distanceBetween(first, second) / active.distance);
      onViewChange(zoomImageAt(view, layout, zoom, midpoint(first, second)));
    } else if (active?.kind === 'pan') {
      onViewChange(panImage(view, layout, point.x - active.last.x, point.y - active.last.y));
      gesture.current = { kind: 'pan', last: point };
    }
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remaining = [...pointers.current.values()][0];
    gesture.current = remaining ? { kind: 'pan', last: remaining } : null;
    if (!remaining) setDragging(false);
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!layout) return;
    onViewChange(isZoomedIn(view)
      ? FIT_IMAGE_ZOOM_VIEW
      : zoomImageAt(view, layout, DOUBLE_CLICK_ZOOM, stagePoint(event.currentTarget, event)));
  };

  const onImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setImageSize({ src, width: naturalWidth, height: naturalHeight });
    onLoad?.(event);
  };

  const transform = layout ? imageZoomTransform(view, layout) : null;
  const zoomedIn = isZoomedIn(view);
  return (
    <div
      ref={stageRef}
      aria-roledescription='zoomable image'
      className={cn(
        'relative overflow-hidden touch-none select-none',
        zoomedIn ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in',
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={onImageLoad}
        className={cn(
          'pointer-events-none absolute left-0 top-0',
          transform ? 'max-w-none origin-top-left' : 'h-full w-full object-contain'
        )}
        style={transform && layout
          ? {
            width: layout.imageWidth,
            height: layout.imageHeight,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }
          : undefined}
      />
    </div>
  );
}

function stagePoint(stage: Element, event: { clientX: number; clientY: number }): StagePoint {
  const rect = stage.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function distanceBetween(a: StagePoint, b: StagePoint): number {
  return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
}

function midpoint(a: StagePoint, b: StagePoint): StagePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
