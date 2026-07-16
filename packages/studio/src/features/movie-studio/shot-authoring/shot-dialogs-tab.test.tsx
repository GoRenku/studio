// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShotDialogsTab } from './shot-dialogs-tab';

describe('ShotDialogsTab', () => {
  it('renders Scene Dialogue Audio without a Take workspace', () => {
    renderTab();
    expect(screen.getByText('Urban')).toBeTruthy();
    expect(screen.getByText('Hold the gate.')).toBeTruthy();
    expect(screen.getByText('Take 1')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Play dialogue audio' })
    ).toBeTruthy();
  });

  it('writes controlled inclusion values', () => {
    const onChange = vi.fn();
    renderTab({ onChange });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Exclude Urban dialogue audio',
      })
    );
    expect(onChange).toHaveBeenCalledWith([
      { dialogueId: 'dialogue_001', inclusion: 'exclude' },
    ]);
  });
});

function renderTab({
  onChange = vi.fn(),
}: {
  onChange?: ReturnType<typeof vi.fn>;
} = {}) {
  return render(
    <ShotDialogsTab
      dialogues={[
        {
          dialogueId: 'dialogue_001',
          speakerName: 'Urban',
          plainText: 'Hold the gate.',
          selectedTakeId: 'dialogue_take_001',
          takes: [{ id: 'dialogue_take_001', label: 'Take 1' }],
        },
      ]}
      values={[{ dialogueId: 'dialogue_001', inclusion: 'include' }]}
      onChange={onChange}
      onSelectTake={vi.fn()}
      onTogglePlayback={vi.fn()}
    />
  );
}
