import type { CastMemberCharacterArcResourceResponse } from '@/services/studio-project-contracts';
import { DEFAULT_BEAT_LABELS, PRIMARY_BEAT_KEYS } from '../../story-arc/story-structure-labels';

/**
 * Layout for the Character Arc timeline. Every row shares one horizontal axis:
 * screenplay scene order. Units are SVG user units inside `viewBox`.
 */
export const TIMELINE_WIDTH = 1116;
export const TIMELINE_GUTTER = 150;
const RIGHT_PAD = 8;
const PLOT_WIDTH = TIMELINE_WIDTH - TIMELINE_GUTTER - RIGHT_PAD;
const ACT_ROW_HEIGHT = 26;
const BEAT_ROWS_HEIGHT = 44;
const PRESENCE_ROW_HEIGHT = 36;
const ARC_TOP_GAP = 40;
export const ARC_HEIGHT = 210;
const MARKER_MIN_GAP = 26;
const BEAT_LABEL_MIN_GAP = 110;
const TICK_MIN_GAP = 26;
const ACT_LABELS: Record<string, string> = { actOne: 'Act I', actTwo: 'Act II', actThree: 'Act III' };

export interface CharacterArcTimelineLayout {
  height: number;
  acts: Array<{ label: string; x: number; width: number }>;
  beats: Array<{ label: string; x: number; level: number }>;
  presence: { y: number; cells: Array<{ x: number; width: number; speaks: boolean; heading: string }> } | null;
  arc: {
    top: number;
    highY: number;
    lowY: number;
    midY: number;
    path: string;
    markers: Array<{ number: number; x: number; trueX: number; y: number; title: string }>;
  };
  ticks: Array<{ x: number; label: string }>;
  axisY: number;
  beatLineBottom: number;
}

type Resource = CastMemberCharacterArcResourceResponse;

export function buildCharacterArcTimeline(resource: Resource): CharacterArcTimelineLayout {
  const sceneIndex = new Map(resource.scenes.map((scene, index) => [scene.id, index]));
  const count = Math.max(resource.scenes.length, 1);
  const xOf = (index: number) => TIMELINE_GUTTER + ((index + 0.5) / count) * PLOT_WIDTH;
  const edgeOf = (index: number) => TIMELINE_GUTTER + (index / count) * PLOT_WIDTH;

  const acts = (resource.structure?.actSegments ?? []).flatMap((act) => {
    const indices = act.sceneIds.flatMap((id) => sceneIndex.has(id) ? [sceneIndex.get(id)!] : []);
    if (indices.length === 0) {
      return [];
    }
    const start = edgeOf(Math.min(...indices));
    return [{ label: ACT_LABELS[act.role] ?? act.title, x: start, width: edgeOf(Math.max(...indices) + 1) - start - 2 }];
  });

  const beatScenes = PRIMARY_BEAT_KEYS.flatMap((key) => {
    const beat = resource.structure?.keyBeats.find((entry) => entry.key === key);
    return beat?.sceneId && sceneIndex.has(beat.sceneId)
      ? [{ label: DEFAULT_BEAT_LABELS[key], index: sceneIndex.get(beat.sceneId)! }]
      : [];
  });
  const beats = stackLabels(beatScenes.map((beat) => ({ label: beat.label, x: xOf(beat.index) })));

  const presenceByScene = new Map(resource.presence.map((entry) => [entry.sceneId, entry.speaks]));
  const hasPresence = presenceByScene.size > 0;
  const presenceY = ACT_ROW_HEIGHT + 6 + BEAT_ROWS_HEIGHT;
  const presence = hasPresence
    ? {
        y: presenceY,
        cells: resource.scenes.flatMap((scene, index) => presenceByScene.has(scene.id)
          ? [{
              x: edgeOf(index),
              width: Math.max(PLOT_WIDTH / count - (count > 60 ? 0 : 2), 1.6),
              speaks: presenceByScene.get(scene.id)!,
              heading: scene.heading,
            }]
          : []),
      }
    : null;

  const arcTop = presenceY + (hasPresence ? PRESENCE_ROW_HEIGHT : 0) + ARC_TOP_GAP;
  const yOf = (position: number) => arcTop + ((5 - position) / 10) * ARC_HEIGHT;
  const points = resource.arc.turningPoints.map((point, index) => ({
    number: index + 1,
    trueX: xOf(sceneIndex.get(point.sceneIds[0]!) ?? 0),
    y: yOf(point.position),
    title: `${index + 1}. ${point.label}: ${point.state}`,
  }));
  const markers = dodge(points);
  const plotRight = TIMELINE_GUTTER + PLOT_WIDTH;
  const path = markers
    .map((marker, index) => (index === 0 ? `M${marker.x},${marker.y}` : `H${marker.x} V${marker.y}`))
    .join(' ') + ` H${plotRight}`;
  const beatLineBottom = arcTop + ARC_HEIGHT + 8;
  const axisY = beatLineBottom + 24;

  return {
    height: axisY + 10,
    acts,
    beats,
    presence,
    arc: { top: arcTop, highY: yOf(5), lowY: yOf(-5), midY: yOf(0), path, markers },
    ticks: buildTicks(resource, acts.length > 0 ? (resource.structure?.actSegments ?? []) : [], beatScenes.map((beat) => beat.index), sceneIndex, xOf),
    axisY,
    beatLineBottom,
  };
}

/** Nudges markers apart so numbered circles never overlap; keeps scene order. */
export function dodge<T extends { trueX: number }>(points: T[]): Array<T & { x: number }> {
  let previous = -Infinity;
  return points.map((point) => {
    const x = Math.max(point.trueX, previous + MARKER_MIN_GAP);
    previous = x;
    return { ...point, x };
  });
}

function stackLabels(labels: Array<{ label: string; x: number }>): Array<{ label: string; x: number; level: number }> {
  let lastX = -Infinity;
  let level = 0;
  return labels.map((entry) => {
    level = entry.x - lastX < BEAT_LABEL_MIN_GAP ? (level + 1) % 3 : 0;
    lastX = entry.x;
    return { ...entry, level };
  });
}

function buildTicks(
  resource: Resource,
  actSegments: Array<{ sceneIds: string[] }>,
  beatIndices: number[],
  sceneIndex: Map<string, number>,
  xOf: (index: number) => number
): Array<{ x: number; label: string }> {
  const last = resource.scenes.length - 1;
  const actStarts = actSegments.flatMap((act) => {
    const indices = act.sceneIds.flatMap((id) => sceneIndex.has(id) ? [sceneIndex.get(id)!] : []);
    return indices.length > 0 ? [Math.min(...indices)] : [];
  });
  const indices = [...new Set([0, last, ...actStarts, ...beatIndices])].filter((index) => index >= 0).sort((a, b) => a - b);
  let lastX = -Infinity;
  return indices.flatMap((index) => {
    const x = xOf(index);
    if (x - lastX < TICK_MIN_GAP && index !== last) {
      return [];
    }
    lastX = x;
    return [{ x, label: resource.scenes[index]?.productionNumber ?? String(index + 1) }];
  });
}

export interface CharacterArcCardGroup {
  label: string;
  cards: Array<{ number: number; turningPointIndex: number; shift: 'up' | 'down' | null }>;
}

/** Groups turning points under act names by their first scene; one unnamed group without acts. */
export function groupTurningPointsByAct(resource: Resource): CharacterArcCardGroup[] {
  const sceneIndex = new Map(resource.scenes.map((scene, index) => [scene.id, index]));
  const points = resource.arc.turningPoints.map((point, index) => {
    const previous = resource.arc.turningPoints[index - 1];
    const shift = !previous || previous.position === point.position
      ? null
      : point.position > previous.position ? 'up' as const : 'down' as const;
    return { number: index + 1, turningPointIndex: index, shift, sceneIndex: sceneIndex.get(point.sceneIds[0]!) ?? -1 };
  });
  const acts = resource.structure?.actSegments ?? [];
  if (acts.length === 0) {
    return [{ label: '', cards: points.map(({ sceneIndex: _scene, ...card }) => card) }];
  }
  const actOf = new Map<number, string>();
  acts.forEach((act) => act.sceneIds.forEach((id) => {
    const index = sceneIndex.get(id);
    if (index !== undefined) {
      actOf.set(index, ACT_LABELS[act.role] ?? act.title);
    }
  }));
  const groups: CharacterArcCardGroup[] = [];
  for (const { sceneIndex: index, ...card } of points) {
    const label = actOf.get(index) ?? '';
    const group = groups[groups.length - 1];
    if (group && group.label === label) {
      group.cards.push(card);
    } else {
      groups.push({ label, cards: [card] });
    }
  }
  return groups;
}
