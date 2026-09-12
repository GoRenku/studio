// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';
import { PrevisCues } from './cues';

afterEach(cleanup);
it('auditions only dialogue and seeks direction points without highlighting active ranges', () => {
  const revision: StudioPrevisRevision = { id: 'r', number: 1, createdAt: '', render: null, clips: { project: { projectName: 'movie' }, shotPlanId: 'plan', previsRevisionId: 'revision', clips: [], assets: [], unassignedAssets: [], sources: [], resourceKeys: [] }, description: null, warnings: [], playback: {
    frameRate: { numerator: 24, denominator: 1 }, frameCount: 240,
    segments: [{ id: 'wide', label: 'Wide', startFrame: 0 }, { id: 'close', label: 'Close', startFrame: 72 }],
    subjects: [{ key: 'mara', label: 'Mara', color: '#ee7744' }],
    cues: [
      { id: 'line', kind: 'dialogue', speaker: 'mara', text: 'Stay.', startFrame: 48, endFrame: 96 },
      { id: 'turn', kind: 'action', subject: 'mara', text: 'Turns.', startFrame: 72 },
      { id: 'focus', kind: 'camera', text: 'Focus changes.', startFrame: 72 },
      { id: 'unknown', kind: 'dialogue', speaker: 'mara', text: 'Wait.', startFrame: 100 },
    ],
  } };
  const seek = vi.fn(); const playDialogue = vi.fn();
  const { container, rerender } = render(<PrevisCues revision={revision} time={3} duration={10} activeCue='line' selection={null} playing seek={seek} playDialogue={playDialogue} />);
  expect(container.querySelectorAll('[data-auditioning=true]')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Play dialogue: Turns.' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Play dialogue: Wait.' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Seek action to frame 72' }));
  expect(seek).toHaveBeenLastCalledWith(3, 'cue:turn');
  expect(playDialogue).not.toHaveBeenCalled();
  rerender(<PrevisCues revision={revision} time={3} duration={10} activeCue={null} selection='cue:turn' playing seek={seek} playDialogue={playDialogue} />);
  expect(container.querySelectorAll('[data-auditioning=true]')).toHaveLength(0);
});
