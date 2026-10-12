import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ImageEditRegion, ImageEditRegionMode } from './contracts.js';
import { imageEditIssue } from './diagnostics.js';

export const IMAGE_EDIT_GRID_SIZE = 1000;
export const IMAGE_EDIT_MIN_REGION_SIDE = 15;

/**
 * Envelope rules for regions: geometry on the 0–1000 grid, unique numbers, a mode the route
 * declares, and instruction presence for modes that require one. Instruction text stays opaque.
 */
export function imageEditRegionIssues(regions: ImageEditRegion[], modes: ImageEditRegionMode[], path: Array<string | number>): DiagnosticIssue[] {
  const numbers = regions.map((region) => region.number);
  return regions.flatMap((region, index) => {
    const at = [...path, index];
    const mode = modes.find((candidate) => candidate.id === region.mode);
    return [
      ...(numbers.indexOf(region.number) !== index ? [imageEditIssue([...at, 'number'], `Region ${region.number} is listed more than once.`)] : []),
      ...(region.number < 1 ? [imageEditIssue([...at, 'number'], 'Region numbers start at 1.')] : []),
      ...(mode ? [] : [imageEditIssue([...at, 'mode'], `Region ${region.number} uses an action this route does not support.`)]),
      ...(mode?.instructionRequired && !region.instruction.trim() ? [imageEditIssue([...at, 'instruction'], `Region ${region.number} needs an instruction.`)] : []),
      ...boxIssues(region, [...at, 'box']),
    ];
  });
}

function boxIssues(region: ImageEditRegion, path: Array<string | number>): DiagnosticIssue[] {
  const { top, left, bottom, right } = region.box;
  const outside = [top, left, bottom, right].some((value) => value < 0 || value > IMAGE_EDIT_GRID_SIZE);
  if (outside) return [imageEditIssue(path, `Region ${region.number} lies outside the 0–${IMAGE_EDIT_GRID_SIZE} grid.`)];
  if (bottom - top < IMAGE_EDIT_MIN_REGION_SIDE || right - left < IMAGE_EDIT_MIN_REGION_SIDE) {
    return [imageEditIssue(path, `Region ${region.number} must be at least ${IMAGE_EDIT_MIN_REGION_SIDE} grid units on each side, with top above bottom and left before right.`)];
  }
  return [];
}
