import type { MediaGenerationShot, MediaGenerationShotPlan } from '../../client/media-generation-context.js';
import type { Shot, ShotPlan } from '../../client/shot-plans.js';
import { projectGenerationAsset } from './reference-assets.js';

export function projectGenerationShot(shot: Shot): MediaGenerationShot {
  return { ...shot, images: shot.images.map(projectGenerationAsset) };
}

export function projectGenerationShotPlan(plan: ShotPlan): MediaGenerationShotPlan {
  return { ...plan, shots: plan.shots.map(projectGenerationShot) };
}
