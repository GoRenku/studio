import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
  type ScreenplayAnalysisCriterion,
  type ScreenplayBeatRole,
} from '@gorenku/studio-core/client';
import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';

/**
 * The chart works in a single fractional coordinate space:
 *   - x runs 0..1 across the plot (left edge to right edge);
 *   - y is a 0..100 level, mapped (domain-aware, with vertical padding) into the
 *     0..100 view box.
 *
 * The SVG uses `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`, so one
 * view-box unit equals one percent of the plot box on each axis. HTML overlays
 * (beat markers, scene rail) are positioned with the same `fraction * 100%`
 * math, which keeps everything pixel-aligned regardless of the rendered size.
 *
 * Each criterion (dramaticEnergy, stakes, characterAgency) is an independent
 * 0..100 *level* of that quality across the story. The chart shows one measure
 * at a time: the analysed (measured) cadence against an ideal expected cadence.
 */
export const VIEW_BOX = {
  width: 100,
  height: 100,
};

/** Vertical padding (view-box units) so peaks/markers never touch the edges. */
const PLOT_PAD_TOP = 15;
const PLOT_PAD_BOTTOM = 12;

export const DEFAULT_CRITERION_COLORS: Record<string, string> = {
  dramaticEnergy: '#f1ac2b',
  stakes: '#7891b7',
  characterAgency: '#668978',
};

export const DEFAULT_BEAT_POSITIONS: Record<ScreenplayBeatRole, number> = {
  hook: 0.06,
  incitingIncident: 0.2,
  firstPlotPoint: 0.36,
  firstPinchPoint: 0.44,
  midpoint: 0.5,
  secondPinchPoint: 0.6,
  secondPlotPoint: 0.68,
  climax: 0.84,
  resolution: 0.96,
};

export const DEFAULT_BEAT_LABELS: Record<ScreenplayBeatRole, string> = {
  hook: 'Hook',
  incitingIncident: 'Inciting Incident',
  firstPlotPoint: 'First Turn',
  firstPinchPoint: 'First Pinch',
  midpoint: 'Midpoint',
  secondPinchPoint: 'Second Pinch',
  secondPlotPoint: 'Crisis',
  climax: 'Climax',
  resolution: 'Resolution',
};

/**
 * Ideal cadence templates for a successful three-act screenplay: the expected
 * *level* (0..100) of each measure at each structural beat. These are domain
 * heuristics (also documented in the screenplay-analyst skill reference), not
 * agent output — the agent only assesses the measured levels.
 */
export const EXPECTED_LEVELS: Record<string, Record<ScreenplayBeatRole, number>> = {
  dramaticEnergy: {
    hook: 45,
    incitingIncident: 42,
    firstPlotPoint: 55,
    firstPinchPoint: 60,
    midpoint: 70,
    secondPinchPoint: 66,
    secondPlotPoint: 80,
    climax: 96,
    resolution: 40,
  },
  stakes: {
    hook: 24,
    incitingIncident: 34,
    firstPlotPoint: 46,
    firstPinchPoint: 54,
    midpoint: 62,
    secondPinchPoint: 72,
    secondPlotPoint: 82,
    climax: 94,
    resolution: 56,
  },
  characterAgency: {
    hook: 30,
    incitingIncident: 30,
    firstPlotPoint: 44,
    firstPinchPoint: 50,
    midpoint: 58,
    secondPinchPoint: 62,
    secondPlotPoint: 74,
    climax: 90,
    resolution: 62,
  },
};

/** Structural beats marked on the chart, in story order. */
export const PRIMARY_BEAT_KEYS: ScreenplayBeatRole[] = [
  'hook',
  'incitingIncident',
  'firstPlotPoint',
  'midpoint',
  'secondPlotPoint',
  'climax',
  'resolution',
];

/** Every beat (in story order) used to shape the smooth expected curve. */
const ALL_BEAT_KEYS = (Object.keys(DEFAULT_BEAT_POSITIONS) as ScreenplayBeatRole[]).sort(
  (a, b) => DEFAULT_BEAT_POSITIONS[a] - DEFAULT_BEAT_POSITIONS[b]
);

export interface StoryArcScenePoint {
  id: string;
  sequenceId: string;
  actId: string;
  title: string;
  actTitle: string;
  sequenceTitle: string;
  storyFunction: string[];
  index: number;
  /** Fractional center of the scene across the plot (0..1). */
  position: number;
}

export interface StoryArcActBand {
  id: string;
  title: string;
  purpose?: string;
  sceneCount: number;
  /** Layout weight used by the header, plot, and rail so columns align. */
  weight: number;
  startFraction: number;
  endFraction: number;
  startPercent: number;
  endPercent: number;
  scenes: StoryArcScenePoint[];
}

export interface StoryArcLineSegment {
  key: string;
  path: string;
}

export interface StoryArcMeasuredPoint {
  key: string;
  xPercent: number;
  yPercent: number;
}

export interface StoryArcBeatMarker {
  key: ScreenplayBeatRole;
  label: string;
  /** Fractional position across the plot the analysis placed the beat at (0..1). */
  position: number;
  /** Typical structural position for this beat (0..1). */
  expectedPosition: number;
  sceneId?: string;
  sequenceId?: string;
  actId?: string;
  synopsis?: string;
  sceneSpecific: boolean;
}

/** Level range mapped to the plot height, so curves frame nicely. */
export interface ScoreDomain {
  min: number;
  max: number;
}

export interface StoryArcChartModel {
  scenes: StoryArcScenePoint[];
  acts: StoryArcActBand[];
  criteria: ScreenplayAnalysisCriterion[];
  beats: StoryArcBeatMarker[];
  hasAnalysis: boolean;
  summary?: string;
}

/** A beat resolved for a single measure: expected vs measured level + position. */
export interface MeasureBeat {
  key: ScreenplayBeatRole;
  label: string;
  sceneId?: string;
  sceneSpecific: boolean;
  synopsis?: string;
  measuredPosition: number;
  expectedPosition: number;
  measuredLevel?: number;
  expectedLevel: number;
}

/** Everything needed to draw one measure's expected-vs-measured comparison. */
export interface MeasureView {
  criterion: ScreenplayAnalysisCriterion;
  color: string;
  domain: ScoreDomain;
  measuredSegments: StoryArcLineSegment[];
  measuredPoints: StoryArcMeasuredPoint[];
  expectedPath: string;
  beats: MeasureBeat[];
  hasMeasured: boolean;
}

export function buildStoryArcChartModel(
  resource: StoryArcResourceResponse
): StoryArcChartModel {
  const acts = buildActBands(resource);
  const scenes = acts.flatMap((act) => act.scenes);
  const criteria = DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA.map((criterion) => ({
    ...criterion,
  }));

  return {
    scenes,
    acts,
    criteria,
    beats: buildBeatMarkers(resource, scenes),
    hasAnalysis: Boolean(resource.activeAnalysis),
    summary: resource.activeAnalysis?.summary,
  };
}

/**
 * Builds the expected-vs-measured view for a single measure. Kept out of the
 * model so it can recompute cheaply when the user switches the focus measure.
 */
export function buildMeasureView(input: {
  criterion: ScreenplayAnalysisCriterion;
  scenes: StoryArcScenePoint[];
  beats: StoryArcBeatMarker[];
  hasAnalysis: boolean;
  scoreForScene: (sceneId: string) => number | undefined;
}): MeasureView {
  const { criterion, scenes, beats, hasAnalysis, scoreForScene } = input;
  const criterionKey = criterion.key;

  const expectedByBeat = ALL_BEAT_KEYS.map((key) => ({
    key,
    position: DEFAULT_BEAT_POSITIONS[key],
    level: expectedLevelFor(criterionKey, key),
  }));

  const measuredScores = hasAnalysis
    ? scenes
        .map((scene) => scoreForScene(scene.id))
        .filter((value): value is number => typeof value === 'number')
    : [];
  const domain = computeDomain([
    ...expectedByBeat.map((entry) => entry.level),
    ...measuredScores,
  ]);

  const expectedPath = buildSmoothPath(
    expectedByBeat.map((entry) => ({
      x: entry.position * VIEW_BOX.width,
      y: scoreToY(entry.level, domain),
    }))
  );

  const measuredSegments = hasAnalysis
    ? buildLineSegments({ scenes, domain, criterionKey, scoreForScene })
    : [];
  const measuredPoints = hasAnalysis
    ? buildIsolatedMeasuredPoints({ scenes, domain, scoreForScene })
    : [];

  const measureBeats: MeasureBeat[] = beats.map((beat) => {
    const measuredLevel =
      hasAnalysis && beat.sceneId ? scoreForScene(beat.sceneId) : undefined;
    return {
      key: beat.key,
      label: beat.label,
      sceneId: beat.sceneId,
      sceneSpecific: beat.sceneSpecific,
      synopsis: beat.synopsis,
      measuredPosition: beat.position,
      expectedPosition: beat.expectedPosition,
      measuredLevel,
      expectedLevel: expectedLevelFor(criterionKey, beat.key),
    };
  });

  return {
    criterion,
    color: DEFAULT_CRITERION_COLORS[criterionKey] ?? '#f1ac2b',
    domain,
    measuredSegments,
    measuredPoints,
    expectedPath,
    beats: measureBeats,
    hasMeasured: measuredSegments.length > 0 || measuredPoints.length > 0,
  };
}

/**
 * Maps a level to a y coordinate within the padded plot band, so the data fills
 * the area (domain-aware) while peaks and markers keep headroom from the edges.
 */
export function scoreToY(score: number, domain: ScoreDomain): number {
  const span = domain.max - domain.min || 1;
  const t = (clamp(score, domain.min, domain.max) - domain.min) / span;
  const usable = VIEW_BOX.height - PLOT_PAD_TOP - PLOT_PAD_BOTTOM;
  return PLOT_PAD_TOP + (1 - t) * usable;
}

function expectedLevelFor(criterionKey: string, beatKey: ScreenplayBeatRole): number {
  return EXPECTED_LEVELS[criterionKey]?.[beatKey] ?? EXPECTED_LEVELS.dramaticEnergy[beatKey];
}

/** Frames the data: rounds to fives, pads, and enforces a minimum span. */
function computeDomain(values: number[]): ScoreDomain {
  if (values.length === 0) {
    return { min: 0, max: 100 };
  }
  let min = clamp(Math.floor((Math.min(...values) - 4) / 5) * 5, 0, 100);
  let max = clamp(Math.ceil((Math.max(...values) + 4) / 5) * 5, 0, 100);
  const MIN_SPAN = 35;
  if (max - min < MIN_SPAN) {
    const mid = (min + max) / 2;
    min = clamp(Math.round((mid - MIN_SPAN / 2) / 5) * 5, 0, 100);
    max = clamp(min + MIN_SPAN, 0, 100);
    min = clamp(max - MIN_SPAN, 0, 100);
  }
  if (min >= max) {
    return { min: 0, max: 100 };
  }
  return { min, max };
}

function buildActBands(resource: StoryArcResourceResponse): StoryArcActBand[] {
  // Weight each act by its scene count (min 1 so empty acts stay visible). The
  // header, plot dividers, and scene rail all share these weights, so their
  // boundaries line up vertically.
  const weighted = resource.acts.map((act) => {
    const sceneCount = act.sequences.reduce(
      (total, sequence) => total + sequence.scenes.length,
      0
    );
    return { act, sceneCount, weight: Math.max(sceneCount, 1) };
  });
  const totalWeight =
    weighted.reduce((total, entry) => total + entry.weight, 0) || 1;

  let cursor = 0;
  return weighted.map(({ act, sceneCount, weight }) => {
    const startFraction = cursor / totalWeight;
    cursor += weight;
    const endFraction = cursor / totalWeight;
    const scenes = act.sequences.flatMap((sequence) =>
      sequence.scenes.map((scene) => ({
        id: scene.id,
        sequenceId: sequence.id,
        actId: act.id,
        title: scene.title,
        actTitle: act.title,
        sequenceTitle: sequence.title,
        storyFunction: scene.storyFunction ?? [],
      }))
    );
    const positioned = scenes.map((scene, sceneIndex) => ({
      ...scene,
      index: sceneIndex,
      position: positionWithinBand({
        startFraction,
        endFraction,
        index: sceneIndex,
        count: scenes.length,
      }),
    }));

    return {
      id: act.id,
      title: act.title,
      purpose: act.purpose,
      sceneCount,
      weight,
      startFraction,
      endFraction,
      startPercent: Math.round(startFraction * 100),
      endPercent: Math.round(endFraction * 100),
      scenes: positioned,
    };
  });
}

function positionWithinBand(input: {
  startFraction: number;
  endFraction: number;
  index: number;
  count: number;
}): number {
  if (input.count <= 0) {
    return (input.startFraction + input.endFraction) / 2;
  }
  const span = input.endFraction - input.startFraction;
  return input.startFraction + ((input.index + 0.5) / input.count) * span;
}

function buildLineSegments(input: {
  scenes: StoryArcScenePoint[];
  domain: ScoreDomain;
  criterionKey: string;
  scoreForScene: (sceneId: string) => number | undefined;
}): StoryArcLineSegment[] {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  for (const scene of input.scenes) {
    const score = input.scoreForScene(scene.id);
    if (typeof score === 'number') {
      current.push({
        x: scene.position * VIEW_BOX.width,
        y: scoreToY(score, input.domain),
      });
      continue;
    }
    if (current.length > 1) {
      segments.push(current);
    }
    current = [];
  }
  if (current.length > 1) {
    segments.push(current);
  }

  return segments.map((points, segmentIndex) => ({
    key: `${input.criterionKey}-${segmentIndex}`,
    path: buildSmoothPath(points),
  }));
}

function buildIsolatedMeasuredPoints(input: {
  scenes: StoryArcScenePoint[];
  domain: ScoreDomain;
  scoreForScene: (sceneId: string) => number | undefined;
}): StoryArcMeasuredPoint[] {
  return input.scenes.flatMap((scene, index) => {
    const score = input.scoreForScene(scene.id);
    if (typeof score !== 'number') {
      return [];
    }

    const previousScore = input.scenes[index - 1]
      ? input.scoreForScene(input.scenes[index - 1].id)
      : undefined;
    const nextScore = input.scenes[index + 1]
      ? input.scoreForScene(input.scenes[index + 1].id)
      : undefined;
    if (typeof previousScore === 'number' || typeof nextScore === 'number') {
      return [];
    }

    return [
      {
        key: scene.id,
        xPercent: round(scene.position * 100),
        yPercent: round(scoreToY(score, input.domain)),
      },
    ];
  });
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  const [first, ...rest] = points;
  if (!first) {
    return '';
  }
  if (rest.length === 0) {
    return `M ${round(first.x)} ${round(first.y)}`;
  }
  return rest.reduce((path, point, index) => {
    const previous = points[index] ?? first;
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${round(controlX)} ${round(previous.y)}, ${round(
      controlX
    )} ${round(point.y)}, ${round(point.x)} ${round(point.y)}`;
  }, `M ${round(first.x)} ${round(first.y)}`);
}

function buildBeatMarkers(
  resource: StoryArcResourceResponse,
  scenes: StoryArcScenePoint[]
): StoryArcBeatMarker[] {
  const beatAnalysisByKey = new Map(
    resource.activeAnalysis?.keyBeats.map((beat) => [beat.key, beat]) ?? []
  );
  return PRIMARY_BEAT_KEYS.map((key) => {
    const beat = beatAnalysisByKey.get(key);
    return {
      key,
      label: beat?.label ?? DEFAULT_BEAT_LABELS[key],
      position: resolveBeatPosition({
        scenes,
        actId: beat?.actId,
        sequenceId: beat?.sequenceId,
        sceneId: beat?.sceneId,
        fallbackPosition: DEFAULT_BEAT_POSITIONS[key],
      }),
      expectedPosition: DEFAULT_BEAT_POSITIONS[key],
      sceneId: beat?.sceneId,
      sequenceId: beat?.sequenceId,
      actId: beat?.actId,
      synopsis: beat?.synopsis,
      sceneSpecific: Boolean(beat?.sceneId),
    };
  });
}

function resolveBeatPosition(input: {
  scenes: StoryArcScenePoint[];
  actId?: string;
  sequenceId?: string;
  sceneId?: string;
  fallbackPosition: number;
}): number {
  const scene = input.sceneId
    ? input.scenes.find((candidate) => candidate.id === input.sceneId)
    : undefined;
  if (scene) {
    return scene.position;
  }

  const scopedScenes = input.sequenceId
    ? input.scenes.filter((candidate) => candidate.sequenceId === input.sequenceId)
    : input.actId
      ? input.scenes.filter((candidate) => candidate.actId === input.actId)
      : [];
  if (scopedScenes.length > 0) {
    const first = scopedScenes[0]?.position ?? 0;
    const last = scopedScenes[scopedScenes.length - 1]?.position ?? first;
    return (first + last) / 2;
  }

  return input.fallbackPosition;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
