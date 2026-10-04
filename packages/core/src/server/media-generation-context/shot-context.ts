import type { MediaGenerationShot, MediaGenerationShotPlan } from '../../client/media-generation-context.js';
import type { Shot, ShotPlan } from '../../client/shot-plans.js';
import type { GenerationAssetFiles } from './reference-assets.js';

export function projectGenerationShot(shot: Shot, assetFiles: GenerationAssetFiles): MediaGenerationShot {
  const { images, ...facts } = shot;
  return { ...facts, imageAssetFileIds: images.map((assetFile) => assetFiles.add(assetFile)) };
}

export function projectGenerationShotPlan(plan: ShotPlan, assetFiles: GenerationAssetFiles): MediaGenerationShotPlan {
  return { ...plan, shots: plan.shots.map((shot) => projectGenerationShot(shot, assetFiles)) };
}
