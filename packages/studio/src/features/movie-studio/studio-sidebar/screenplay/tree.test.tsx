// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MovieStudioNavigationState } from '../../use-movie-studio-navigation';
import { ScreenplayTree } from './tree';

describe('ScreenplayTree', () => {
  it('renders flat, mixed, direct-Scene, nested, and empty Section shapes', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ScreenplayTree
        navigation={navigation()}
        selection={{ type: 'scene', id: 'scene_nested' }}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('button', { name: /Root Scene/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Act Direct Scene/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Nested Scene/ })).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /^Empty Act0 scenes$/ })
    ).not.toBeNull();
    expect(container.querySelectorAll('.lucide-book-open')).toHaveLength(2);
    expect(container.querySelectorAll('.lucide-layers')).toHaveLength(2);
    expect(container.querySelectorAll('.lucide-file-text').length).toBeGreaterThan(2);

    fireEvent.click(screen.getByLabelText('Expand Root Sequence'));
    expect(screen.getByRole('button', { name: /Sequence Scene/ })).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: /^Root Sequence1 scene$/ })
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Expand Root Sequence')).not.toBeNull();
  });
});

function navigation(): MovieStudioNavigationState {
  const screenplay = {
    opening: [],
    sections: [
      { id: 'section_root_sequence', type: 'sequence' as const, title: 'Root Sequence' },
      { id: 'section_act', type: 'act' as const, title: 'Main Act' },
      { id: 'section_nested', type: 'sequence' as const, title: 'Nested Sequence' },
      { id: 'section_empty', type: 'act' as const, title: 'Empty Act' },
    ],
    scenes: [
      scene('scene_root', '1', 'Root Scene'),
      scene('scene_sequence', '2', 'Sequence Scene'),
      scene('scene_direct', '3', 'Act Direct Scene'),
      scene('scene_nested', '4A', 'Nested Scene'),
    ],
    structure: [
      entry('entry_root_scene', 0, { type: 'scene' as const, sceneId: 'scene_root' }),
      entry('entry_root_sequence', 1, {
        type: 'section' as const,
        sectionId: 'section_root_sequence',
      }),
      entry('entry_sequence_scene', 0, {
        type: 'scene' as const,
        sceneId: 'scene_sequence',
      }, 'section_root_sequence'),
      entry('entry_act', 2, { type: 'section' as const, sectionId: 'section_act' }),
      entry('entry_direct_scene', 0, {
        type: 'scene' as const,
        sceneId: 'scene_direct',
      }, 'section_act'),
      entry('entry_nested_sequence', 1, {
        type: 'section' as const,
        sectionId: 'section_nested',
      }, 'section_act'),
      entry('entry_nested_scene', 0, {
        type: 'scene' as const,
        sceneId: 'scene_nested',
      }, 'section_nested'),
      entry('entry_empty', 3, {
        type: 'section' as const,
        sectionId: 'section_empty',
      }),
    ],
    references: [],
  };
  const structureResource = {
    screenplay,
    orderedSceneIds: screenplay.scenes.map((scene) => scene.id),
  };
  return {
    cast: [],
    locations: [],
    props: [],
    screenplay: structureResource,
    sectionsById: new Map(screenplay.sections.map((section) => [section.id, section])),
    scenesById: new Map(screenplay.scenes.map((scene) => [scene.id, scene])),
    orderedScenes: screenplay.scenes,
    error: null,
    selectionContext: null,
  };
}

function scene(id: string, productionNumber: string, title: string) {
  return {
    id,
    productionNumber,
    heading: `INT. ${title.toUpperCase()} - DAY`,
    title,
    blocks: [],
  };
}

function entry(
  id: string,
  position: number,
  content: { type: 'scene'; sceneId: string } | { type: 'section'; sectionId: string },
  parentSectionId?: string
) {
  return { id, position, content, parentSectionId };
}
