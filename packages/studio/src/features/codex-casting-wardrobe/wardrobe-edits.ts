import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import { sceneSummary } from '@/features/casting-views/scene-labels';

/** A Look or costume of a draft: a name and the scenes it covers. */
export interface SceneGroup {
  name: string;
  sceneIds: string[];
}

/**
 * Moves the scene to the next group among the allowed ones, then to none, then back to the first.
 * Other groups lose the scene; scene lists stay in screenplay order.
 */
export function cycleScene<T extends SceneGroup>(groups: T[], allowed: number[], sceneId: string, scenes: SceneStripScene[]): T[] {
  if (allowed.length === 0) return groups;
  const current = allowed.findIndex((index) => groups[index]!.sceneIds.includes(sceneId));
  const target = current === -1 ? allowed[0]! : allowed[current + 1];
  const order = new Map(scenes.map((scene, index) => [scene.id, index]));
  return groups.map((group, index) => {
    const without = group.sceneIds.filter((id) => id !== sceneId);
    const sceneIds = index === target ? [...without, sceneId].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity)) : without;
    return sceneIds.length === group.sceneIds.length && index !== target ? group : { ...group, sceneIds };
  });
}

/** The group indexes that cover a scene's run in the strip, by scene id. */
export function sceneOwners(groups: SceneGroup[]): Map<string, number> {
  const owners = new Map<string, number>();
  groups.forEach((group, index) => group.sceneIds.forEach((sceneId) => owners.set(sceneId, index)));
  return owners;
}

/** "1 change: scenes 1–2 → Quest hunter" or "no changes", comparing scene owners before and after. */
export function sceneChanges(before: SceneGroup[], after: SceneGroup[], scenes: SceneStripScene[], unassigned: string): string {
  const beforeOwners = sceneOwners(before);
  const afterOwners = sceneOwners(after);
  const moved = new Map<string, string[]>();
  for (const scene of scenes) {
    const owner = afterOwners.get(scene.id);
    if (beforeOwners.get(scene.id) === owner) continue;
    const name = owner === undefined ? unassigned : after[owner]!.name;
    moved.set(name, [...(moved.get(name) ?? []), scene.id]);
  }
  if (moved.size === 0) return 'no changes';
  const parts = [...moved].map(([name, sceneIds]) => `${lowerFirst(sceneSummary(sceneIds, scenes))} → ${name}`);
  return `${moved.size} ${moved.size === 1 ? 'change' : 'changes'}: ${parts.join('; ')}`;
}

/** "Young (scenes 3–8), Older (scenes 1–2, 9–14)" */
export function groupsSummary(groups: SceneGroup[], scenes: SceneStripScene[]): string {
  return groups.map((group) => `${group.name} (${lowerFirst(sceneSummary(group.sceneIds, scenes))})`).join(', ');
}

export function coveredSceneCount(groups: SceneGroup[]): number {
  return new Set(groups.flatMap((group) => group.sceneIds)).size;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
