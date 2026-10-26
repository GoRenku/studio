/** Favorite and challenger side by side, or the favorite on top and the challenger below. */
export type CompareArrangement = 'side-by-side' | 'stacked';

/** The header row above each compared image (`h-11`). */
export const COMPARE_HEADER_HEIGHT = 44;

/**
 * Picks the arrangement that shows both images larger in the compare area, using the favorite's
 * natural size; side by side when both are equal.
 */
export function compareArrangement(input: {
  areaWidth: number;
  areaHeight: number;
  imageWidth: number;
  imageHeight: number;
}): CompareArrangement {
  const { areaWidth, areaHeight, imageWidth, imageHeight } = input;
  const sideBySide = fittedImageWidth(areaWidth / 2, areaHeight - COMPARE_HEADER_HEIGHT, imageWidth, imageHeight);
  const stacked = fittedImageWidth(areaWidth, areaHeight / 2 - COMPARE_HEADER_HEIGHT, imageWidth, imageHeight);
  return stacked > sideBySide ? 'stacked' : 'side-by-side';
}

function fittedImageWidth(stageWidth: number, stageHeight: number, imageWidth: number, imageHeight: number): number {
  if (stageWidth <= 0 || stageHeight <= 0) return 0;
  return Math.min(stageWidth, (stageHeight * imageWidth) / imageHeight);
}
