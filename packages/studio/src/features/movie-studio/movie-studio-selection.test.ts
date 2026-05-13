import { describe, expect, it } from 'vitest';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveMovieStudioSelection,
} from './movie-studio-selection';

describe('movie studio selection', () => {
  it('resolves clip selections to the clip title', () => {
    const lookup = buildMovieStudioLookup(makeProject());

    const selected = resolveMovieStudioSelection(
      { type: 'clip', id: 'clip_1_1_1' },
      lookup
    );

    expect(selected.kicker).toBe('Opening Image');
    expect(selected.clip?.id).toBe('clip_1_1_1');
    expect(selected.clips).toHaveLength(1);
  });

  it('resolves cast selections to the cast member name', () => {
    const lookup = buildMovieStudioLookup(makeProject());

    const selected = resolveMovieStudioSelection(
      { type: 'cast', id: 'cast_narrator' },
      lookup
    );

    expect(selected.kicker).toBe('Narrator');
    expect(selected.castEntry?.id).toBe('cast_narrator');
  });

  it('resolves sequence selections to the sequence title', () => {
    const lookup = buildMovieStudioLookup(makeProject());

    const selected = resolveMovieStudioSelection(
      { type: 'sequence', id: 'seq_opening' },
      lookup
    );

    expect(selected.kicker).toBe('Opening');
  });

  it('resolves scene selections to the scene title', () => {
    const lookup = buildMovieStudioLookup(makeProject());

    const selected = resolveMovieStudioSelection(
      { type: 'scene', id: 'scene_1_1' },
      lookup
    );

    expect(selected.kicker).toBe('Opening Scene');
  });

  it('falls back to the full storyboard for stale story selections', () => {
    const lookup = buildMovieStudioLookup(makeProject());

    const selected = resolveMovieStudioSelection(
      { type: 'scene', id: 'missing_scene' },
      lookup
    );

    expect(selected.kicker).toBe('Full Storyboard');
    expect(selected.clips.map((clip) => clip.id)).toEqual(['clip_1_1_1']);
  });
});

function makeProject(): ProjectShellWithHttp {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
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
    continuityReferences: [],
    sequences: [
      {
        id: 'seq_opening',
        number: 1,
        title: 'Opening',
        shortTitle: 'Opening',
        summary: 'The opening sequence.',
        scenes: [
          {
            id: 'scene_1_1',
            title: 'Opening Scene',
            summary: 'The movie begins.',
            clips: [
              {
                id: 'clip_1_1_1',
                title: 'Opening Image',
                summary: 'Establish the movie.',
              },
            ],
          },
        ],
      },
    ],
    episodes: [],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
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
      continuityReferences: { items: [], nextCursor: null },
      storyStructure: {
        projectType: 'standaloneMovie',
        sequences: {
          items: [
            {
              id: 'seq_opening',
              number: 1,
              title: 'Opening',
              shortTitle: 'Opening',
              sceneCount: 1,
              clipCount: 1,
            },
          ],
          nextCursor: null,
        },
      },
    },
  };
}
