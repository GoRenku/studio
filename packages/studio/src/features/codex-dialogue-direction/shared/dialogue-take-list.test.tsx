// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionAction, DialogueDirectionTake } from '@gorenku/studio-codex/dialogue-direction';
import { dialogueDirectionTakeFixture } from '../testing/dialogue-direction-session-fixture';
import { DialogueTakeList } from './dialogue-take-list';

const media = { load: vi.fn(() => new Promise<string>(() => {})) };
const onSelect = vi.fn();
const onDiscard = vi.fn();

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function renderTakes(takes: DialogueDirectionTake[], action: DialogueDirectionAction | null = null) {
  return render(<DialogueTakeList takes={takes} selection={{ start: 7, end: 9 }} action={action} media={media} disabled={false} onSelect={onSelect} onDiscard={onDiscard} />);
}

describe('DialogueTakeList', () => {
  it('lists only this route Takes for the exact selection, newest first', () => {
    renderTakes([
      dialogueDirectionTakeFixture('other-model', 7, 9, { matchesRoute: false, createdAt: '2026-10-09T10:03:00.000Z' }),
      dialogueDirectionTakeFixture('older', 7, 9, { createdAt: '2026-10-09T10:00:00.000Z' }),
      dialogueDirectionTakeFixture('single', 7, 7, { createdAt: '2026-10-09T10:01:00.000Z' }),
      dialogueDirectionTakeFixture('newer', 7, 9, { createdAt: '2026-10-09T10:02:00.000Z' }),
    ]);
    expect(screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'))).toEqual(['Take 2', 'Take 1']);
  });

  it('shows a dashed placeholder for the next Take while the action is outstanding', () => {
    renderTakes([dialogueDirectionTakeFixture('take', 7, 9)], { actionId: 'action', turnRange: { start: 7, end: 9 }, status: 'running' });
    expect(screen.getByRole('listitem', { name: 'Generating Take 2' })).toBeTruthy();
  });

  it('replaces the placeholder with the reported failure', () => {
    renderTakes([], { actionId: 'action', turnRange: { start: 7, end: 9 }, status: 'failed', message: 'ElevenLabs rejected the voice.' });
    expect(screen.queryByRole('listitem', { name: /Generating/ })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('ElevenLabs rejected the voice.');
  });

  it('toggles selection from the radio', () => {
    renderTakes([dialogueDirectionTakeFixture('selected', 7, 9, { selected: true, createdAt: '2026-10-09T10:01:00.000Z' }), dialogueDirectionTakeFixture('other', 7, 9)]);
    fireEvent.click(within(screen.getByRole('listitem', { name: 'Take 2' })).getByRole('radio'));
    expect(onSelect).toHaveBeenLastCalledWith('selected', false);
    fireEvent.click(within(screen.getByRole('listitem', { name: 'Take 1' })).getByRole('radio'));
    expect(onSelect).toHaveBeenLastCalledWith('other', true);
  });

  it('deletes only after inline confirmation and keeps the Take on Keep', () => {
    renderTakes([dialogueDirectionTakeFixture('take', 7, 9)]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Take 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Take 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDiscard).toHaveBeenCalledWith('take');
  });
});
