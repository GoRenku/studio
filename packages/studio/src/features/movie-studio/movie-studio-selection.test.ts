import { describe, expect, it } from 'vitest';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { StoryNavigationState } from './use-story-navigation';
import {
  buildMovieStudioLookup,
  resolveStudioSelection,
} from './movie-studio-selection';

describe('movie studio selection', () => {
  it('resolves scene selections to the scene title', () => {
    const lookup = buildMovieStudioLookup(makeProject(), makeStoryNavigation());

    const selected = resolveStudioSelection(
      { type: 'scene', id: 'scene_1_1' },
      lookup
    );

    expect(selected.kicker).toBe('Opening Scene');
    expect(selected.scene?.id).toBe('scene_1_1');
    expect(selected.scenes).toHaveLength(1);
  });

  it('resolves cast selections to the cast member name', () => {
    const lookup = buildMovieStudioLookup(makeProject(), makeStoryNavigation());

    const selected = resolveStudioSelection(
      { type: 'cast', id: 'cast_narrator' },
      lookup
    );

    expect(selected.kicker).toBe('Narrator');
    expect(selected.castEntry?.id).toBe('cast_narrator');
  });

  it('resolves sequence selections to the sequence title', () => {
    const lookup = buildMovieStudioLookup(makeProject(), makeStoryNavigation());

    const selected = resolveStudioSelection(
      { type: 'sequence', id: 'seq_opening' },
      lookup
    );

    expect(selected.kicker).toBe('Opening');
  });

  it('falls back to the full storyboard for stale story selections', () => {
    const lookup = buildMovieStudioLookup(makeProject(), makeStoryNavigation());

    const selected = resolveStudioSelection(
      { type: 'scene', id: 'missing_scene' },
      lookup
    );

    expect(selected.kicker).toBe('Full Storyboard');
    expect(selected.scenes.map((scene) => scene.id)).toEqual(['scene_1_1']);
  });
});

function makeProject(): ProjectShellWithHttp {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      folderPath: '/tmp/constantinople',
      databasePath: '/tmp/constantinople/.renku/project.sqlite',
    },
    coverImage: null,
    coverUrl: null,
    languages: [],
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [
      {
        id: 'cast_narrator',
        name: 'Narrator',
        kind: 'narrator',
        role: 'voiceover',
      },
    ],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      sequences: 1,
      scenes: 1,
    },
    navigation: {
      cast: {
        items: [
          {
            id: 'cast_narrator',
            name: 'Narrator',
            kind: 'narrator',
            role: 'voiceover',
          },
        ],
        nextCursor: null,
      },
      visualLanguage: { items: [], nextCursor: null },
      screenplay: {
        sequences: {
          items: [
            {
              id: 'seq_opening',
              number: 1,
              title: 'Opening',
              shortTitle: 'Opening',
              sceneCount: 1,
            },
          ],
          nextCursor: null,
        },
      },
    },
  };
}

function makeStoryNavigation(): StoryNavigationState {
  return {
    sequences: [
      {
        id: 'seq_opening',
        number: 1,
        title: 'Opening',
        shortTitle: 'Opening',
        sceneCount: 1,
      },
    ],
    scenesBySequenceId: new Map([
      [
        'seq_opening',
        [
          {
            id: 'scene_1_1',
            sequenceId: 'seq_opening',
            title: 'Opening Scene',
          },
        ],
      ],
    ]),
    loadingKeys: new Set(),
    error: null,
    loadSequenceScenes: async () => {},
  };
}
