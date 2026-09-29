import type { MediaGenerationShot, MediaGenerationShotPlan } from '../../client/media-generation-context.js';
import type { Shot, ShotPlan } from '../../client/shot-plans.js';
import type { GenerationAssets } from './reference-assets.js';

export function projectGenerationShot(shot: Shot, assets: GenerationAssets): MediaGenerationShot {
  const { images, ...facts } = shot;
  return { ...facts, imageAssetIds: images.map((asset) => assets.add(asset)) };
}

export function projectGenerationShotPlan(plan: ShotPlan, assets: GenerationAssets): MediaGenerationShotPlan {
  return { ...plan, shots: plan.shots.map((shot) => projectGenerationShot(shot, assets)) };
}
