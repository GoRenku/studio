import { describe, expect, it } from 'vitest';
import { boxFromDrag, gridPointFromClient, isRegionTooSmall, moveBox, resizeBox } from './region-geometry';

describe('region geometry', () => {
  it('maps pointer positions onto the clamped 0–1000 grid', () => {
    const rect = { top: 100, left: 50, width: 400, height: 200 };
    expect(gridPointFromClient(rect, 250, 200)).toEqual({ y: 500, x: 500 });
    expect(gridPointFromClient(rect, 0, 1000)).toEqual({ y: 1000, x: 0 });
  });

  it('normalizes a drag in any direction and flags drags that are too small', () => {
    expect(boxFromDrag({ y: 600, x: 700 }, { y: 100, x: 200 })).toEqual({ top: 100, left: 200, bottom: 600, right: 700 });
    expect(isRegionTooSmall(boxFromDrag({ y: 100, x: 100 }, { y: 110, x: 400 }))).toBe(true);
    expect(isRegionTooSmall(boxFromDrag({ y: 100, x: 100 }, { y: 200, x: 400 }))).toBe(false);
  });

  it('moves a box without leaving the grid', () => {
    const box = { top: 100, left: 100, bottom: 300, right: 400 };
    expect(moveBox(box, { y: 50, x: -20 })).toEqual({ top: 150, left: 80, bottom: 350, right: 380 });
    expect(moveBox(box, { y: -500, x: 900 })).toEqual({ top: 0, left: 700, bottom: 200, right: 1000 });
  });

  it('resizes from a corner while keeping the minimum size and the grid', () => {
    const box = { top: 100, left: 100, bottom: 300, right: 400 };
    expect(resizeBox(box, 'br', { y: 500, x: 1200 })).toEqual({ top: 100, left: 100, bottom: 500, right: 1000 });
    expect(resizeBox(box, 'tl', { y: 299, x: 399 })).toEqual({ top: 285, left: 385, bottom: 300, right: 400 });
  });
});
