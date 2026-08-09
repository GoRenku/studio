import type { Scene } from '@gorenku/studio-core/client';

export function displaySceneProductionNumber(productionNumber?: string): string {
  return productionNumber ?? '';
}

export function sceneDisplayLabel(
  scene: Pick<Scene, 'productionNumber' | 'title' | 'heading'>
): string {
  const number = displaySceneProductionNumber(scene.productionNumber);
  const title = scene.title?.trim();
  if (number && title) return `${number} - ${title}`;
  if (number) return number;
  if (title) return title;
  return scene.heading;
}
