// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SceneStrip } from './scene-strip';

const scenes = ['1', '2', '3', '4', '5'].map((label) => ({ id: `scene_${label}`, label }));

describe('SceneStrip', () => {
  it('merges each run of neighbouring scenes into one band cell and leaves uncovered scenes empty', () => {
    render(
      <SceneStrip
        scenes={scenes}
        bands={[
          {
            label: 'Look',
            rows: [
              { sceneIds: ['scene_1', 'scene_2', 'scene_3'], name: 'Young', tone: 'lookA' },
              { sceneIds: ['scene_5'], name: 'Older', tone: 'lookB', highlighted: true },
            ],
          },
          {
            label: 'Costume',
            rows: [
              { sceneIds: ['scene_1', 'scene_3'], name: 'Cloak', tone: 'costume' },
              { sceneIds: ['scene_2'], name: 'Overalls', tone: 'costume' },
            ],
          },
        ]}
      />
    );

    expect(screen.getAllByText(/^[1-5]$/).map((cell) => cell.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getByTitle('Young').style.gridColumn).toBe('span 3');
    expect(screen.getByTitle('Older').className).toContain('ring-primary');
    expect(screen.getAllByTitle('Cloak').map((cell) => cell.style.gridColumn)).toEqual(['span 1', 'span 1']);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('reports a click on one scene of a merged cell with its band', () => {
    const onSceneClick = vi.fn();
    render(
      <SceneStrip
        scenes={scenes}
        bands={[{ label: 'Look', rows: [{ sceneIds: ['scene_1', 'scene_2'], name: 'Young', tone: 'lookA' }] }]}
        onSceneClick={onSceneClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Look · Scene 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Look · Scene 4' }));

    expect(onSceneClick.mock.calls).toEqual([['Look', 'scene_2'], ['Look', 'scene_4']]);
  });
});
