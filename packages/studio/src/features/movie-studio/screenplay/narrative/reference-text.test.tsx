// @vitest-environment jsdom
import React from 'react';
import type { ScreenplayReference, StudioSelection } from '@gorenku/studio-core/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReferenceText } from './reference-text';

vi.mock('@/services/studio-continuity-api', () => ({
  readCastMemberResource: vi.fn().mockRejectedValue(new Error('not loaded')),
  readLocationResource: vi.fn().mockRejectedValue(new Error('not loaded')),
  readPropResource: vi.fn().mockRejectedValue(new Error('not loaded')),
}));

describe('ReferenceText', () => {
  it('preserves Unicode, punctuation, repeated names, and adjacent exact ranges', () => {
    const onSelect = vi.fn<(selection: StudioSelection) => void>();
    const text = '🎬 Ana, AnaRome.';
    const references: ScreenplayReference[] = [
      reference('cast', 'castMember', 'cast_ana', 3, 3),
      reference('location', 'location', 'location_ana', 8, 3),
      reference('prop', 'prop', 'prop_rome', 11, 4),
      {
        id: 'presence',
        subject: { type: 'prop', id: 'prop_offscreen' },
        target: { type: 'block', sceneId: 'scene_one', blockId: 'block_one' },
        role: 'presence',
      },
    ];
    const { container } = render(
      <p>
        <ReferenceText
          projectName='basilica'
          text={text}
          references={references}
          onSelect={onSelect}
        />
      </p>
    );

    expect(container.textContent).toBe(text);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ana' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ana' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Rome' }));
    expect(onSelect.mock.calls.map(([selection]) => selection)).toEqual([
      { type: 'castMember', id: 'cast_ana' },
      { type: 'location', id: 'location_ana' },
      { type: 'prop', id: 'prop_rome' },
    ]);
    expect(screen.queryByRole('button', { name: 'prop_offscreen' })).toBeNull();
  });
});

function reference(
  id: string,
  type: 'castMember' | 'location' | 'prop',
  subjectId: string,
  start: number,
  length: number
): ScreenplayReference {
  const subject =
    type === 'castMember'
      ? { type, id: subjectId }
      : type === 'location'
        ? { type, id: subjectId }
        : { type, id: subjectId };
  return {
    id,
    subject,
    target: { type: 'block', sceneId: 'scene_one', blockId: 'block_one' },
    role: 'mention',
    range: { start, length },
  };
}
