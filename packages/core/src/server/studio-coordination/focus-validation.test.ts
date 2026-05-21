import { describe, expect, it } from 'vitest';
import type { Project } from '../../client/index.js';
import {
  resolveStudioSelectionForProject,
  validateStudioFocusRequestForProject,
} from './focus-validation.js';

describe('Studio focus validation', () => {
  it('resolves project-level Movie Studio selections', () => {
    const project = makeProject();

    expect(
      resolveStudioSelectionForProject(project, {
        type: 'projectInformation',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'projectInformation',
        title: 'Preparation of the Siege',
      },
    });
    expect(
      resolveStudioSelectionForProject(project, { type: 'visualLanguage' })
    ).toMatchObject({
      ok: true,
      context: { kind: 'visualLanguage' },
    });
    expect(
      resolveStudioSelectionForProject(project, { type: 'storyboard' })
    ).toMatchObject({
      ok: true,
      context: { kind: 'storyboard' },
    });
    expect(
      resolveStudioSelectionForProject(project, { type: 'casting' })
    ).toMatchObject({
      ok: true,
      context: { kind: 'casting' },
    });
  });

  it('resolves screenplay and cast selections to current context', () => {
    const project = makeProject();

    expect(
      resolveStudioSelectionForProject(project, {
        type: 'sequence',
        id: 'seq_opening',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'sequence',
        id: 'seq_opening',
      },
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'scene',
        id: 'scene_1_1',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'scene',
        id: 'scene_1_1',
        parentSequence: { id: 'seq_opening' },
      },
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'clip',
        id: 'clip_1_1_1',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'clip',
        id: 'clip_1_1_1',
        parentScene: { id: 'scene_1_1' },
        parentSequence: { id: 'seq_opening' },
      },
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'cast',
        id: 'cast_narrator',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'castMember',
        id: 'cast_narrator',
      },
    });
  });

  it('rejects missing Movie Studio selections with structured diagnostics', () => {
    const project = makeProject();

    expect(
      resolveStudioSelectionForProject(project, {
        type: 'sequence',
        id: 'missing_sequence',
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'STUDIO_COORDINATION030', severity: 'error' }],
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'scene',
        id: 'missing_scene',
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'STUDIO_COORDINATION031', severity: 'error' }],
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'clip',
        id: 'missing_clip',
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'STUDIO_COORDINATION032', severity: 'error' }],
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'cast',
        id: 'missing_cast',
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'STUDIO_COORDINATION033', severity: 'error' }],
    });
  });

  it('validates full Studio focus requests', () => {
    const project = makeProject();

    expect(
      validateStudioFocusRequestForProject(project, {
        screen: 'projectLibrary',
      })
    ).toEqual({
      ok: true,
      focus: { screen: 'projectLibrary' },
      context: null,
    });
    expect(
      validateStudioFocusRequestForProject(project, {
        screen: 'movieStudio',
        selection: { type: 'scene', id: 'missing_scene' },
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
    });
  });
});

function makeProject(): Project {
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
    languages: [],
    visualLanguageCategories: [
      {
        id: 'visual_language_category_1',
        name: 'Lighting',
        source: 'project',
      },
    ],
    visualLanguage: [
      {
        id: 'visual_language_1',
        categoryId: 'visual_language_category_1',
        name: 'Painterly Realism',
        priority: 'default',
      },
    ],
    cast: [
      {
        id: 'cast_narrator',
        name: 'Narrator',
        kind: 'narrator',
        role: 'voiceover',
      },
    ],
    continuityReferences: [],
    episodes: [],
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
    counts: {
      languages: 0,
      visualLanguageCategories: 1,
      visualLanguage: 1,
      castMembers: 1,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
  };
}
