import type { ScreenplayAnalysisBeatRole } from '@gorenku/studio-core/client';

/** Display names for story beats, shared by the Story Arc and Character Arc charts. */
export const DEFAULT_BEAT_LABELS: Record<ScreenplayAnalysisBeatRole, string> = {
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

/** Structural beats marked on the chart, in story order. */
export const PRIMARY_BEAT_KEYS: ScreenplayAnalysisBeatRole[] = [
  'hook',
  'incitingIncident',
  'firstPlotPoint',
  'midpoint',
  'secondPlotPoint',
  'climax',
  'resolution',
];
