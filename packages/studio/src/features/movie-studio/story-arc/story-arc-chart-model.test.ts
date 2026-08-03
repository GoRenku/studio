import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
} from '@gorenku/studio-core/client';
import {
  buildMeasureView,
  buildStoryArcChartModel,
} from './story-arc-chart-model';
import { storyArcResource } from './story-arc-test-fixtures';

describe('story arc chart model', () => {
  it('positions Scenes inside analysis-owned Act segments', () => {
    const resource = storyArcResource();
    const model = buildStoryArcChartModel(resource);
    const criterion = DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA[0];
    const analyses = new Map(
      resource.activeAnalysis!.sceneAnalyses.map((scene) => [scene.sceneId, scene])
    );
    const view = buildMeasureView({
      criterion,
      scenes: model.scenes,
      beats: model.beats,
      hasAnalysis: true,
      scoreForScene: (sceneId) =>
        analyses.get(sceneId)?.scoreByCriterion[criterion.key],
    });

    expect(model.acts.map((act) => act.id)).toEqual(['actOne']);
    expect(model.scenes.map((scene) => scene.id)).toEqual(['scene_hook']);
    expect(view.measuredPoints).toHaveLength(1);
  });
});
