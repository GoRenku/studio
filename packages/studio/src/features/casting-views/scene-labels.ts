import type { SceneStripScene } from './scene-strip';

/** Scene labels as the screenplay numbers them, falling back to screenplay order. */
export function castingSceneLabels(scenes: Array<{ id: string; productionNumber?: string }>): SceneStripScene[] {
  return scenes.map((scene, index) => ({ id: scene.id, label: scene.productionNumber ?? String(index + 1) }));
}

/** "Scenes 3–8", "Scenes 1–2, 9–14" or "Scene 13", grouping neighbouring scenes in screenplay order. */
export function sceneSummary(sceneIds: string[], scenes: SceneStripScene[]): string {
  const included = new Set(sceneIds);
  const runs: SceneStripScene[][] = [];
  let previousIncluded = false;
  scenes.forEach((scene) => {
    const isIncluded = included.has(scene.id);
    if (isIncluded && previousIncluded) {
      runs[runs.length - 1]!.push(scene);
    } else if (isIncluded) {
      runs.push([scene]);
    }
    previousIncluded = isIncluded;
  });
  if (runs.length === 0) {
    return 'No scenes yet';
  }
  const labels = runs.map((run) =>
    run.length === 1 ? run[0]!.label : `${run[0]!.label}–${run[run.length - 1]!.label}`
  );
  const plural = runs.length > 1 || runs[0]!.length > 1;
  return `${plural ? 'Scenes' : 'Scene'} ${labels.join(', ')}`;
}

/** "Scene 13" for one scene, else "15 scenes": short enough for a card. */
export function shortSceneLabel(sceneIds: string[], scenes: SceneStripScene[]): string {
  if (sceneIds.length > 1) {
    return `${sceneIds.length} scenes`;
  }
  return sceneSummary(sceneIds, scenes);
}
