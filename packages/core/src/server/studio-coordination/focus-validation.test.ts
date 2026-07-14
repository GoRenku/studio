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
      resolveStudioSelectionForProject(project, {
        type: 'lookbook',
        kind: 'production',
      })
    ).toMatchObject({
      ok: true,
      context: { kind: 'visualLanguage', sections: ['inspiration', 'lookbooks'] },
    });
    expect(
      resolveStudioSelectionForProject(project, { type: 'storyArc' })
    ).toMatchObject({
      ok: true,
      context: { kind: 'storyArc' },
    });
    expect(
      resolveStudioSelectionForProject(project, { type: 'cast' })
    ).toMatchObject({
      ok: true,
      context: { kind: 'cast' },
    });
    expect(
      resolveStudioSelectionForProject(project, { type: 'locations' })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'locations',
        locations: [{ id: 'location_walls', name: 'City Walls' }],
      },
    });
  });

  it('resolves screenplay, cast, and location selections to current context', () => {
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
        sceneTab: 'shots',
        shotId: 'shot_001',
        shotTab: 'composition',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'scene',
        id: 'scene_1_1',
        sceneTab: { id: 'shots', label: 'Shots' },
        parentSequence: { id: 'seq_opening' },
      },
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'castMember',
        id: 'cast_narrator',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'castMember',
        id: 'cast_narrator',
      },
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'location',
        id: 'location_walls',
      })
    ).toMatchObject({
      ok: true,
      context: {
        kind: 'location',
        id: 'location_walls',
        name: 'City Walls',
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
        type: 'castMember',
        id: 'missing_cast',
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'STUDIO_COORDINATION033', severity: 'error' }],
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'location',
        id: 'missing_location',
      })
    ).toMatchObject({
      ok: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'STUDIO_COORDINATION035', severity: 'error' }],
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

  it('rejects unsupported scene and shot tab focus values with structured diagnostics', () => {
    const project = makeProject();

    expect(
      resolveStudioSelectionForProject(project, {
        type: 'scene',
        id: 'scene_1_1',
        sceneTab: 'script' as never,
      })
    ).toMatchObject({
      ok: false,
      reason: 'unsupportedSelection',
      diagnostics: [{ code: 'STUDIO_COORDINATION036', severity: 'error' }],
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'scene',
        id: 'scene_1_1',
        sceneTab: 'shots',
        shotTab: 'camera' as never,
      })
    ).toMatchObject({
      ok: false,
      reason: 'unsupportedSelection',
      diagnostics: [{ code: 'STUDIO_COORDINATION037', severity: 'error' }],
    });
    expect(
      resolveStudioSelectionForProject(project, {
        type: 'scene',
        id: 'scene_1_1',
        sceneTab: 'narrative',
        shotId: 'shot_001',
      })
    ).toMatchObject({
      ok: false,
      reason: 'unsupportedSelection',
      diagnostics: [{ code: 'STUDIO_COORDINATION036', severity: 'error' }],
    });
  });
});

function makeProject(): Project {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      folderPath: '/tmp/constantinople',
      databasePath: '/tmp/constantinople/.renku/project.sqlite',
      aspectRatio: '16:9',
    },
    coverImage: null,
    languages: [],
    cast: [
      {
        id: 'cast_narrator',
        handle: 'narrator',
        name: 'Narrator',
        isVoiceOver: true,
        role: 'voiceover',
      },
    ],
    locations: [
      {
        id: 'location_walls',
        handle: 'walls',
        name: 'City Walls',
        timePeriod: 'Dawn',
        description: 'The outer walls where the opening scene begins.',
      },
    ],
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
          },
        ],
      },
    ],
    counts: {
      languages: 0,
      castMembers: 1,
      locations: 1,
      acts: 1,
      sequences: 1,
      scenes: 1,
    },
  };
}
