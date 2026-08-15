import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
  type StoryArcResource,
} from '@gorenku/studio-core/client';

export function storyArcResource(active = true): StoryArcResource {
  return {
    project: {
      title: 'Basilica',
      logline: 'A maker faces the cost of his invention.',
    },
    scenes: [
      {
        id: 'scene_hook',
        productionNumber: '1',
        heading: 'EXT. THEODOSIAN WALLS - DAWN',
        title: 'Bombardment',
      },
    ],
    activeAnalysis: active
      ? {
          structureModel: 'threeAct',
          title: 'Pressure pass',
          summary: 'The opening begins under pressure.',
          criteria: [...DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA],
          actSegments: [
            {
              role: 'actOne',
              title: 'The Offer',
              synopsis: 'The bargain begins.',
              sceneIds: ['scene_hook'],
              scoreByCriterion: { dramaticEnergy: 45 },
              critique: {
                summary: 'Clear opening.',
                evidence: [],
                suggestions: [],
              },
            },
          ],
          keyBeats: [],
          sceneAnalyses: [
            {
              sceneId: 'scene_hook',
              synopsis: 'The cannon faces the city.',
              scoreByCriterion: { dramaticEnergy: 45 },
              critique: {
                summary: 'The image is clear.',
                evidence: [],
                suggestions: [],
              },
            },
          ],
          suggestedScenes: [],
        }
      : null,
    activeAnalysisFreshness: 'current',
    needsRefresh: false,
    freshnessHelp: null,
  };
}
