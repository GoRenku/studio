import { describe, expect, it } from 'vitest';
import type { ProjectShell } from '../../client/index.js';
import {
  resolveStudioSelectionForProject,
  validateStudioFocusRequestForProject,
} from './focus-validation.js';

describe('Studio focus validation', () => {
  it('resolves Project, Screenplay, and independent Scene selections from ProjectShell', () => {
    const shell = makeProjectShell();

    expect(resolveStudioSelectionForProject(shell, {
      type: 'projectInformation',
    })).toMatchObject({
      ok: true,
      context: { kind: 'projectInformation', title: 'Preparation of the Siege' },
    });
    expect(resolveStudioSelectionForProject(shell, {
      type: 'screenplay',
    })).toMatchObject({
      ok: true,
      context: {
        kind: 'screenplay',
        scenes: [{ id: 'scene_1', heading: 'EXT. CITY WALLS - DAWN' }],
      },
    });
    expect(resolveStudioSelectionForProject(shell, {
      type: 'scene',
      id: 'scene_1',
      sceneTab: 'beats',
      beatId: 'beat_1',
    })).toMatchObject({
      ok: true,
      context: {
        kind: 'scene',
        id: 'scene_1',
        parentSections: [{ id: 'section_opening', type: 'sequence' }],
        sceneTab: { id: 'beats', label: 'Beats' },
      },
    });
  });

  it('rejects missing entities and invalid tab-specific focus', () => {
    const shell = makeProjectShell();
    expect(resolveStudioSelectionForProject(shell, {
      type: 'scene',
      id: 'scene_missing',
    })).toMatchObject({ ok: false, reason: 'selectionNotFound' });
    expect(resolveStudioSelectionForProject(shell, {
      type: 'scene',
      id: 'scene_1',
      beatId: 'beat_1',
      sceneTab: 'narrative',
    })).toMatchObject({ ok: false, reason: 'unsupportedSelection' });
  });

  it('validates Movie Studio and Project Library focus requests', () => {
    const shell = makeProjectShell();
    expect(validateStudioFocusRequestForProject(shell, {
      screen: 'movieStudio',
      selection: { type: 'storyArc' },
    })).toMatchObject({ ok: true, context: { kind: 'storyArc' } });
    expect(validateStudioFocusRequestForProject(shell, {
      screen: 'projectLibrary',
    })).toEqual({
      ok: true,
      focus: { screen: 'projectLibrary' },
      context: null,
    });
  });
});

function makeProjectShell(): ProjectShell {
  return {
    project: {
      id: 'project_test0001',
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      aspectRatio: '16:9',
      coverImage: null,
      counts: {
        languages: 0,
        castMembers: 1,
        locations: 1,
        props: 1,
        acts: 0,
        sequences: 1,
        scenes: 1,
      },
    },
    languages: [],
    navigation: {
      cast: {
        items: [{ id: 'cast_narrator', handle: 'narrator', name: 'Narrator', isVoiceOver: true }],
        nextCursor: null,
      },
      locations: {
        items: [{ id: 'location_walls', handle: 'walls', name: 'City Walls' }],
        nextCursor: null,
      },
      props: {
        items: [{ id: 'prop_cannon', handle: 'cannon', name: 'Field Cannon' }],
        nextCursor: null,
      },
      screenplay: {
        orderedSceneIds: ['scene_1'],
        screenplay: {
          opening: [],
          scenes: [{
            id: 'scene_1',
            productionNumber: '1',
            heading: 'EXT. CITY WALLS - DAWN',
            blocks: [{ id: 'block_1', type: 'action', text: 'Smoke rises.' }],
          }],
          sections: [{ id: 'section_opening', type: 'sequence', title: 'Opening' }],
          structure: [
            {
              id: 'entry_section',
              content: { type: 'section', sectionId: 'section_opening' },
              position: 0,
            },
            {
              id: 'entry_scene',
              parentSectionId: 'section_opening',
              content: { type: 'scene', sceneId: 'scene_1' },
              position: 0,
            },
          ],
          references: [],
        },
      },
    },
  };
}
