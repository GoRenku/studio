import type { Screenplay, ScreenplayStructureEntry } from '../../client/screenplay/index.js';
import type { ScreenplayAnalysisMethod } from '../../client/screenplay-analysis/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function screenplayAnalysisMethod(screenplay: Screenplay): ScreenplayAnalysisMethod {
  const acts = screenplay.sections.filter((section) => section.type === 'act');
  if (acts.length === 0) {
    if (screenplay.scenes.length < 3) {
      return unsupported(
        0,
        `Three-act Screenplay Analysis requires at least three Scenes; this Screenplay has ${screenplay.scenes.length}.`,
      );
    }
    return { supported: true, model: 'threeAct', sourceActMode: 'flat' };
  }
  if (acts.length !== 3) {
    return unsupported(acts.length, `Screenplay Analysis currently supports only the three-act method; this Screenplay has ${acts.length} source Acts.`);
  }

  const entriesByParent = groupEntriesByParent(screenplay.structure);
  const sourceActs = acts.map((act) => ({
    id: act.id,
    title: act.title,
    sceneIds: descendantSceneIds(act.id, entriesByParent, new Set()),
  }));
  if (sourceActs.some((act) => act.sceneIds.length === 0)) {
    return unsupported(
      acts.length,
      'Screenplay Analysis requires each of the three source Acts to contain at least one Scene.',
    );
  }
  const partition = sourceActs.flatMap((act) => act.sceneIds);
  const orderedSceneIds = screenplay.scenes.map((scene) => scene.id);
  if (new Set(partition).size !== partition.length
    || JSON.stringify(partition) !== JSON.stringify(orderedSceneIds)) {
    return unsupported(
      acts.length,
      'Screenplay Analysis requires exactly three source Acts that partition every current Scene once in canonical order.',
    );
  }
  return { supported: true, model: 'threeAct', sourceActMode: 'sourceThreeAct', sourceActs };
}

export function requireSupportedScreenplayAnalysis(screenplay: Screenplay): Exclude<ScreenplayAnalysisMethod, { supported: false }> {
  const method = screenplayAnalysisMethod(screenplay);
  if (!method.supported) {
    throw new ProjectDataError(
      'SCREENPLAY_ANALYSIS_THREE_ACT_UNSUPPORTED',
      method.reason,
      { suggestion: 'Use a flat Screenplay with at least three Scenes or exactly three non-empty source Acts for the current three-act analysis workflow.' },
    );
  }
  return method;
}

function groupEntriesByParent(entries: ScreenplayStructureEntry[]): Map<string, ScreenplayStructureEntry[]> {
  const result = new Map<string, ScreenplayStructureEntry[]>();
  for (const entry of entries) {
    const key = entry.parentSectionId ?? 'root';
    const siblings = result.get(key) ?? [];
    siblings.push(entry);
    result.set(key, siblings);
  }
  for (const siblings of result.values()) {
    siblings.sort((left, right) => left.position - right.position);
  }
  return result;
}

function descendantSceneIds(
  sectionId: string,
  entriesByParent: Map<string, ScreenplayStructureEntry[]>,
  visited: Set<string>,
): string[] {
  if (visited.has(sectionId)) {
    return [];
  }
  visited.add(sectionId);
  const result: string[] = [];
  for (const entry of entriesByParent.get(sectionId) ?? []) {
    if (entry.content.type === 'scene') {
      result.push(entry.content.sceneId);
    } else {
      result.push(...descendantSceneIds(entry.content.sectionId, entriesByParent, visited));
    }
  }
  return result;
}

function unsupported(sourceActCount: number, reason: string): ScreenplayAnalysisMethod {
  return { supported: false, model: 'threeAct', sourceActMode: 'unsupported', sourceActCount, reason };
}
