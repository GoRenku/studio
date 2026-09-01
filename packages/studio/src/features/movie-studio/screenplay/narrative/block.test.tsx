// @vitest-environment jsdom
import React from 'react';
import type { ScreenplayBlock } from '@gorenku/studio-core/client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrativeBlock } from './block';

describe('NarrativeBlock', () => {
  it('renders the complete block union and canonical dialogue turn numbers', () => {
    const blocks: ScreenplayBlock[] = [
      ...(['action', 'transition', 'shot', 'lyrics', 'castList', 'note',
        'specialHeading', 'titleCard', 'super'] as const).map((type) => ({
        id: `block_${type}`,
        type,
        text: `Text for ${type}`,
      })),
      {
        id: 'turn_single',
        type: 'dialogue',
        characterName: 'SARA',
        extensions: ['V.O.'],
        parts: [
          { id: 'part_direction', type: 'parenthetical', text: 'quietly' },
          { id: 'part_speech', type: 'speech', text: 'Hold the line.' },
        ],
      },
      {
        id: 'block_dual',
        type: 'dualDialogue',
        left: {
          id: 'turn_left',
          characterName: 'ANA',
          extensions: [],
          parts: [{ id: 'part_left', type: 'speech', text: 'Now.' }],
        },
        right: {
          id: 'turn_right',
          characterName: 'MARA',
          extensions: [],
          parts: [{ id: 'part_right', type: 'speech', text: 'Wait.' }],
        },
      },
    ];

    render(
      <div>
        {blocks.map((block) => (
          <NarrativeBlock
            key={block.id}
            projectName='basilica'
            block={block}
            references={[]}
            turnNumbers={new Map([
              ['turn_single', 1],
              ['turn_left', 2],
              ['turn_right', 3],
            ])}
            onSelect={() => undefined}
          />
        ))}
      </div>
    );

    for (const type of ['action', 'transition', 'shot', 'lyrics', 'castList',
      'note', 'specialHeading', 'titleCard', 'super']) {
      expect(screen.getByText(`Text for ${type}`)).not.toBeNull();
    }
    expect(screen.getByText('quietly').parentElement?.textContent).toBe('(quietly)');
    expect(screen.getByRole('region', { name: 'Dual Dialogue' })).not.toBeNull();
    expect(screen.getByText('1')).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText('3')).not.toBeNull();
  });
});
