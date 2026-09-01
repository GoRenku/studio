// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaCardAudioTake } from './media-card-audio-take';

describe('MediaCardAudioTake', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  it('shows the approved compact audio facts without dialogue or a right action column', () => {
    render(
      <MediaCardAudioTake
        turnLabel='Turns 1–5'
        audioUrl='/audio/take.mp3'
        durationSeconds={32}
        speakers={[
          speaker('one'),
          speaker('two'),
          speaker('three'),
          speaker('four'),
          speaker('five'),
        ]}
        provenance='Seed Audio 1.0 · Fal.ai'
        date='Generated May 8, 2025'
        selected
        selection={{
          kind: 'toggle',
          selected: true,
          selectedLabel: 'Remove selected audio',
          unselectedLabel: 'Select audio',
          onToggle: vi.fn(),
        }}
        deleteAction={{
          label: 'Delete audio',
          confirmationTitle: 'Delete Dialogue Audio?',
          confirmationMessage: 'Move this audio to Trash.',
          onDelete: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('Turns 1–5')).toBeTruthy();
    expect(screen.getByText('+2 speakers')).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.queryByText('Whole Shot Plan')).toBeNull();
    expect(screen.queryByText('Single Turn')).toBeNull();
    expect(screen.queryByText('More than 3 selected')).toBeNull();
    expect(screen.queryByText('0:32')).toBeNull();
    const deleteAction = screen.getByRole('button', { name: 'Delete audio' })
      .closest('[data-media-card-delete-action]');
    expect(deleteAction?.className).toContain('opacity-0');
    expect(deleteAction?.className).toContain('group-hover:opacity-100');
  });

  it('reuses the voice-over profile placeholder when a speaker has no selected image', () => {
    render(
      <MediaCardAudioTake
        turnLabel='Turn 1'
        audioUrl='/audio/narrator.mp3'
        durationSeconds={11}
        speakers={[{
          key: 'narrator',
          name: 'Narrator',
          profileUrl: null,
          isVoiceOver: true,
        }]}
        provenance='Eleven V3 · Elevenlabs'
        date='Generated Jul 1, 2026'
        selected={false}
        selection={{
          kind: 'toggle',
          selected: false,
          selectedLabel: 'Remove selected audio',
          unselectedLabel: 'Select audio',
          onToggle: vi.fn(),
        }}
        deleteAction={{
          label: 'Delete audio',
          confirmationTitle: 'Delete Dialogue Audio?',
          confirmationMessage: 'Move this audio to Trash.',
          onDelete: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('voice-over-profile-placeholder')).toBeTruthy();
    expect(screen.queryByLabelText('Narrator has no selected profile image')).toBeNull();
  });
});

function speaker(id: string) {
  return {
    key: id,
    name: `Speaker ${id}`,
    profileUrl: `/profiles/${id}.jpg`,
    isVoiceOver: false,
  };
}
