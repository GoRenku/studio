import type { ImageEditRegionBox } from '@gorenku/studio-codex/image-edit';

/** Regions live on the model's 0–1000 grid, [top, left, bottom, right], origin top-left. */
export const REGION_GRID_SIZE = 1000;
/** Matches the runtime's minimum region side; smaller drags count as a click. */
export const REGION_MIN_SIDE = 15;

export type RegionHandle = 'tl' | 'tr' | 'bl' | 'br';
export interface GridPoint { y: number; x: number }

export function clampToGrid(value: number): number {
  return Math.max(0, Math.min(REGION_GRID_SIZE, Math.round(value)));
}

export function gridPointFromClient(rect: { top: number; left: number; width: number; height: number }, clientX: number, clientY: number): GridPoint {
  return {
    y: clampToGrid(((clientY - rect.top) / rect.height) * REGION_GRID_SIZE),
    x: clampToGrid(((clientX - rect.left) / rect.width) * REGION_GRID_SIZE),
  };
}

export function boxFromDrag(start: GridPoint, end: GridPoint): ImageEditRegionBox {
  return {
    top: Math.min(start.y, end.y),
    left: Math.min(start.x, end.x),
    bottom: Math.max(start.y, end.y),
    right: Math.max(start.x, end.x),
  };
}

export function isRegionTooSmall(box: ImageEditRegionBox): boolean {
  return box.bottom - box.top < REGION_MIN_SIDE || box.right - box.left < REGION_MIN_SIDE;
}

/** Moves a box by a grid offset while keeping it entirely on the grid. */
export function moveBox(box: ImageEditRegionBox, offset: GridPoint): ImageEditRegionBox {
  const dy = Math.max(-box.top, Math.min(REGION_GRID_SIZE - box.bottom, offset.y));
  const dx = Math.max(-box.left, Math.min(REGION_GRID_SIZE - box.right, offset.x));
  return { top: box.top + dy, left: box.left + dx, bottom: box.bottom + dy, right: box.right + dx };
}

/** Drags one corner to a point, keeping the opposite corner fixed and the minimum size. */
export function resizeBox(box: ImageEditRegionBox, handle: RegionHandle, point: GridPoint): ImageEditRegionBox {
  const next = { ...box };
  if (handle[0] === 't') next.top = Math.min(point.y, box.bottom - REGION_MIN_SIDE);
  else next.bottom = Math.max(point.y, box.top + REGION_MIN_SIDE);
  if (handle[1] === 'l') next.left = Math.min(point.x, box.right - REGION_MIN_SIDE);
  else next.right = Math.max(point.x, box.left + REGION_MIN_SIDE);
  return {
    top: clampToGrid(next.top),
    left: clampToGrid(next.left),
    bottom: clampToGrid(next.bottom),
    right: clampToGrid(next.right),
  };
}

export function boxStyle(box: ImageEditRegionBox) {
  return {
    top: `${box.top / 10}%`,
    left: `${box.left / 10}%`,
    height: `${(box.bottom - box.top) / 10}%`,
    width: `${(box.right - box.left) / 10}%`,
  };
}

const REGION_HUES = [262, 18, 170, 202, 42, 330];

/** A stable outline colour per region number; regions sit on the photograph, so these are theme-independent. */
export function regionColor(number: number): { hue: number; stroke: string; fill: string } {
  const hue = REGION_HUES[(number - 1) % REGION_HUES.length]!;
  return { hue, stroke: `hsl(${hue} 75% 58%)`, fill: `hsl(${hue} 80% 60% / 0.08)` };
}
