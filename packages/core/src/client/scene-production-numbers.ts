import type { ScreenplayCommandReport } from './screenplay.js';

const SCENE_PRODUCTION_NUMBER_PATTERN = /^0*([1-9][0-9]*)([A-Za-z]*)$/;

export interface SceneProductionNumberReference {
  productionNumber: string;
  sceneId: string;
  title: string;
}

export interface SceneProductionNumberListReport extends ScreenplayCommandReport {
  sceneNumbers: SceneProductionNumberReference[];
}

export interface SceneProductionNumberResolveReport extends ScreenplayCommandReport {
  scene: SceneProductionNumberReference;
}

export function normalizeSceneProductionNumber(value: string): string | null {
  const match = SCENE_PRODUCTION_NUMBER_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  return `${match[1]}${match[2]!.toUpperCase()}`;
}

export function formatSceneProductionNumber(productionNumber: string): string {
  const normalized = normalizeSceneProductionNumber(productionNumber);
  if (!normalized) {
    throw new RangeError(`Invalid production scene number: ${productionNumber}`);
  }
  const match = /^([1-9][0-9]*)([A-Z]*)$/.exec(normalized)!;
  return `${match[1]!.padStart(2, '0')}${match[2]}`;
}
