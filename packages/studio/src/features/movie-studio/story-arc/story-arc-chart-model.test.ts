import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
  type StoryArcResource,
} from '@gorenku/studio-core/client';
import {
  buildMeasureView,
  buildStoryArcChartModel,
} from './story-arc-chart-model';

describe('story arc chart model', () => {
  it('keeps an isolated measured point when only one scene has a score', () => {
    const resource = storyArcResource();
    const model = buildStoryArcChartModel(resource);
    const criterion = DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA[0];
    const sceneAnalysisById = new Map(
      resource.activeAnalysis?.scenes.map((scene) => [scene.sceneId, scene]) ?? []
    );

    const view = buildMeasureView({
      criterion,
      scenes: model.scenes,
      beats: model.beats,
      hasAnalysis: model.hasAnalysis,
      scoreForScene: (sceneId) =>
        sceneAnalysisById.get(sceneId)?.scoreByCriterion[criterion.key],
    });

    expect(view.hasMeasured).toBe(true);
    expect(view.measuredPoints).toHaveLength(1);
    expect(view.measuredPoints[0]?.key).toBe('scene_hook');
    expect(view.measuredSegments).toHaveLength(0);
  });
});

function storyArcResource(): StoryArcResource {
  return {
    screenplay: {
      title: 'Basilica',
      logline: 'A maker faces the cost of his invention.',
      dramaticQuestion: 'Can Urban remain only a maker?',
      premiseOverview: 'A siege story about invention and responsibility.',
      centralConflict: 'Pride collides with consequence.',
      summary: 'Urban follows the greatest commission of his life.',
    },
    acts: [
      {
        id: 'act_one',
        title: 'The Offer',
        sequenceCount: 1,
        sceneCount: 1,
        sequences: [
          {
            id: 'seq_offer',
            actId: 'act_one',
            number: 1,
            title: 'The Sound That Opens Stone',
            sceneCount: 1,
            scenes: [
              {
                id: 'scene_hook',
                sequenceId: 'seq_offer',
                title: 'The Sound That Opens Stone',
                setting: { locationIds: [] },
                storyFunction: ['Urban reveals the cannon.'],
              },
            ],
          },
        ],
      },
    ],
    activeAnalysis: {
      kind: 'screenplayAnalysis',
      structureModel: 'threeAct',
      title: 'Single scene pressure pass',
      summary: 'The opening has one analyzed scene.',
      criteria: [...DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA],
      acts: [],
      keyBeats: [],
      sequences: [],
      scenes: [
        {
          sceneId: 'scene_hook',
          sequenceId: 'seq_offer',
          actId: 'act_one',
          title: 'The Sound That Opens Stone',
          synopsis: 'Urban presents the cannon.',
          scoreByCriterion: {
            dramaticEnergy: 45,
            stakes: 35,
            characterAgency: 28,
          },
          critique: {
            summary: 'The image is clear.',
            evidence: [{ sceneId: 'scene_hook', text: 'Urban presents the cannon.' }],
            suggestions: ['Give Urban an immediate choice.'],
          },
        },
      ],
      suggestedSceneAdditions: [],
    },
  };
}
