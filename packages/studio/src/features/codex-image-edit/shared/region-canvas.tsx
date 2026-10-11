import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ImageEditRegion, ImageEditRegionBox } from '@gorenku/studio-codex/image-edit';
import { cn } from '@/lib/utils';
import {
  boxFromDrag,
  boxStyle,
  gridPointFromClient,
  isRegionTooSmall,
  moveBox,
  regionColor,
  resizeBox,
  REGION_GRID_SIZE,
  type GridPoint,
  type RegionHandle,
} from './region-geometry';

export interface RegionCanvasComparison {
  beforeUrl?: string;
  beforeLabel: string;
  afterLabel: string;
}

type CanvasDrag =
  | { kind: 'draw'; start: GridPoint; box: ImageEditRegionBox }
  | { kind: 'move'; number: number; start: GridPoint; origin: ImageEditRegionBox }
  | { kind: 'resize'; number: number; handle: RegionHandle; origin: ImageEditRegionBox }
  | { kind: 'split' };

const HANDLES: RegionHandle[] = ['tl', 'tr', 'bl', 'br'];
const HANDLE_POSITION: Record<RegionHandle, string> = {
  tl: '-left-1.5 -top-1.5 cursor-nwse-resize',
  tr: '-right-1.5 -top-1.5 cursor-nesw-resize',
  bl: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
  br: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
};

/**
 * The image with its numbered regions. When `editable`, dragging on empty image space draws a region,
 * dragging a region moves it and dragging a corner resizes it. With `comparison`, dragging moves the
 * before/after split instead. Regions show only their coloured number.
 */
export function RegionCanvas(input: {
  imageUrl?: string;
  comparison: RegionCanvasComparison | null;
  regions: ImageEditRegion[];
  selectedNumber: number | null;
  editable: boolean;
  nextNumber: number;
  onSelect: (number: number | null) => void;
  onCreate: (box: ImageEditRegionBox) => void;
  onChange: (number: number, box: ImageEditRegionBox) => void;
}) {
  const fit = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<CanvasDrag | null>(null);
  const [aspect, setAspect] = useState<number>();
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [draft, setDraft] = useState<ImageEditRegionBox | null>(null);
  const comparisonKey = `${input.comparison?.beforeUrl ?? ''}|${input.imageUrl ?? ''}`;
  const [splitState, setSplitState] = useState({ key: comparisonKey, value: 0.5 });
  const split = splitState.key === comparisonKey ? splitState.value : 0.5;
  const setSplit = (value: number) => setSplitState({ key: comparisonKey, value });

  useEffect(() => {
    if (!input.imageUrl) return;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active && image.naturalWidth && image.naturalHeight) setAspect(image.naturalWidth / image.naturalHeight); };
    image.src = input.imageUrl;
    return () => { active = false; };
  }, [input.imageUrl]);

  useEffect(() => {
    const element = fit.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth - 36;
      const height = element.clientHeight - 36;
      if (width <= 0 || height <= 0) return;
      const ratio = aspect ?? 1;
      const fitted = width / ratio > height ? { width: height * ratio, height } : { width, height: width / ratio };
      setSize({ width: Math.floor(fitted.width), height: Math.floor(fitted.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  const pointFor = (event: ReactPointerEvent) => gridPointFromClient(frame.current!.getBoundingClientRect(), event.clientX, event.clientY);
  const regionByNumber = (number: number) => input.regions.find((region) => region.number === number);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointFor(event);
    if (input.comparison) {
      drag.current = { kind: 'split' };
      setSplit(point.x / REGION_GRID_SIZE);
    } else if (input.editable) {
      const target = event.target as HTMLElement;
      const handle = target.closest<HTMLElement>('[data-handle]');
      const region = target.closest<HTMLElement>('[data-region]');
      if (handle && region) {
        const number = Number(region.dataset.region);
        drag.current = { kind: 'resize', number, handle: handle.dataset.handle as RegionHandle, origin: regionByNumber(number)!.box };
      } else if (region) {
        const number = Number(region.dataset.region);
        input.onSelect(number);
        drag.current = { kind: 'move', number, start: point, origin: regionByNumber(number)!.box };
      } else {
        drag.current = { kind: 'draw', start: point, box: boxFromDrag(point, point) };
        setDraft(drag.current.box);
      }
    } else {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = pointFor(event);
    if (current.kind === 'split') setSplit(point.x / REGION_GRID_SIZE);
    if (current.kind === 'draw') {
      current.box = boxFromDrag(current.start, point);
      setDraft(current.box);
    }
    if (current.kind === 'move') input.onChange(current.number, moveBox(current.origin, { y: point.y - current.start.y, x: point.x - current.start.x }));
    if (current.kind === 'resize') input.onChange(current.number, resizeBox(current.origin, current.handle, point));
  };

  // Reads the drawn box from the drag record: a quick release can arrive before React re-renders.
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.kind !== 'draw') return;
    setDraft(null);
    if (isRegionTooSmall(current.box)) input.onSelect(null);
    else input.onCreate(current.box);
  };

  const splitPercent = `${(split * 100).toFixed(2)}%`;
  return (
    <div ref={fit} className='relative grid min-h-0 min-w-0 flex-1 place-items-center overflow-hidden p-[18px] max-[760px]:min-h-[360px]'>
      <div
        ref={frame}
        data-testid='region-canvas'
        aria-label={input.comparison ? 'Before and after comparison' : 'Image with edit regions'}
        className={cn('relative touch-none select-none overflow-hidden rounded-[3px] shadow-[0_6px_24px_hsl(0_0%_0%/0.25)]', input.editable && !input.comparison && 'cursor-crosshair', input.comparison && 'cursor-ew-resize')}
        style={size ? { width: size.width, height: size.height } : { width: '100%', aspectRatio: String(aspect ?? 1) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {input.comparison ? (
          <>
            {input.comparison.beforeUrl ? <img alt='' src={input.comparison.beforeUrl} className='pointer-events-none absolute inset-0 size-full object-cover' /> : null}
            {input.imageUrl ? <img alt='' src={input.imageUrl} className='pointer-events-none absolute inset-0 size-full object-cover' style={{ clipPath: `inset(0 0 0 ${splitPercent})` }} /> : null}
            <span aria-hidden className='pointer-events-none absolute inset-y-0 w-0.5 -translate-x-px bg-white' style={{ left: splitPercent }} />
            <span aria-hidden className='pointer-events-none absolute top-1/2 grid size-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-800 shadow-[0_2px_8px_hsl(0_0%_0%/0.4)]' style={{ left: splitPercent }}>
              <ArrowLeftRight className='size-3.5' />
            </span>
            <ImageTag className='left-2'>{input.comparison.beforeLabel}</ImageTag>
            <ImageTag className='right-2'>{input.comparison.afterLabel}</ImageTag>
          </>
        ) : (
          <>
            {input.imageUrl ? <img alt='' src={input.imageUrl} className='pointer-events-none absolute inset-0 size-full object-cover' /> : null}
            {input.editable ? input.regions.map((region) => <RegionBox key={region.number} region={region} selected={region.number === input.selectedNumber} />) : null}
            {draft ? <span aria-hidden className='absolute border-2 border-dashed bg-white/10' style={{ ...boxStyle(draft), borderColor: regionColor(input.nextNumber).stroke }} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function RegionBox(input: { region: ImageEditRegion; selected: boolean }) {
  const color = regionColor(input.region.number);
  const remove = input.region.mode === 'remove';
  return (
    <div
      data-region={input.region.number}
      aria-label={`Region ${input.region.number}`}
      className={cn('absolute cursor-move border-2', remove ? 'border-dashed' : 'border-solid', input.selected && 'shadow-[0_0_0_1px_hsl(0_0%_0%/0.5),0_0_0_9999px_hsl(0_0%_0%/0.18)]')}
      style={{
        ...boxStyle(input.region.box),
        borderColor: color.stroke,
        background: remove ? `repeating-linear-gradient(135deg, hsl(${color.hue} 80% 60% / 0.22) 0 6px, transparent 6px 12px)` : color.fill,
      }}
    >
      <span className='absolute -left-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-[5px] px-1 font-mono text-[11px] font-bold text-white' style={{ background: color.stroke }}>{input.region.number}</span>
      {input.selected ? HANDLES.map((handle) => (
        <span key={handle} data-handle={handle} className={cn('absolute size-2.5 rounded-[2px] border-2 bg-white', HANDLE_POSITION[handle])} style={{ borderColor: color.stroke }} />
      )) : null}
    </div>
  );
}

function ImageTag(input: { className: string; children: string }) {
  return <span className={cn('pointer-events-none absolute top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-white', input.className)}>{input.children}</span>;
}
