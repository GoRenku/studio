import { describe, expect, it } from 'vitest';
import { compareArrangement } from './compare-arrangement';

// A face plus full-body sheet, about 4:3.
const wideSheet = { imageWidth: 1600, imageHeight: 1200 };
// A single portrait, 2:3.
const portrait = { imageWidth: 800, imageHeight: 1200 };

describe('compare arrangement', () => {
  it('stacks wide images in a tall panel', () => {
    expect(compareArrangement({ areaWidth: 1070, areaHeight: 1070, ...wideSheet })).toBe('stacked');
  });

  it('keeps wide images side by side in a wide panel', () => {
    expect(compareArrangement({ areaWidth: 1600, areaHeight: 700, ...wideSheet })).toBe('side-by-side');
  });

  it('keeps portraits side by side in a tall panel', () => {
    expect(compareArrangement({ areaWidth: 1070, areaHeight: 1070, ...portrait })).toBe('side-by-side');
  });

  it('stays side by side when both arrangements show the image at the same size', () => {
    // Square image: 500 wide either way (half the width side by side, half the height less a header stacked).
    expect(compareArrangement({ areaWidth: 1000, areaHeight: 1088, imageWidth: 1000, imageHeight: 1000 })).toBe('side-by-side');
  });

  it('stays side by side when the area is too short to stack', () => {
    expect(compareArrangement({ areaWidth: 2000, areaHeight: 80, ...wideSheet })).toBe('side-by-side');
  });
});
