// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaGenerationReferenceCard, type MediaGenerationReferencePresentation } from './media-generation-reference-card';

afterEach(cleanup);

const reference: MediaGenerationReferencePresentation = {
  kind: 'audio', requestPointer: '/audio', reviewLabel: 'Narration', available: true,
};

describe('generation reference audio playback', () => {
  it('exposes native controls directly for automatically loaded audio without a card-wide click target', () => {
    const loadPreview = vi.fn();
    render(<MediaGenerationReferenceCard reference={reference} source={{ browserUrl: 'blob:narration', loadPreview }} />);
    const player = screen.getByLabelText('Narration') as HTMLAudioElement;
    expect(player.tagName).toBe('AUDIO');
    expect(player.controls).toBe(true);
    expect(player.getAttribute('src')).toBe('blob:narration');
    expect(player.autoplay).toBe(false);
    expect(player.muted).toBe(false);
    expect(screen.queryByRole('button', { name: 'Open Narration preview' })).toBeNull();
    fireEvent.click(player);
    expect(loadPreview).not.toHaveBeenCalled();
  });

  it('removes the card activation layer once a manually retried audio load succeeds', async () => {
    const loadPreview = vi.fn().mockResolvedValue('blob:narration');
    render(<MediaGenerationReferenceCard reference={reference} source={{ loadPreview }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Narration preview' }));
    await waitFor(() => expect(screen.getByLabelText('Narration').getAttribute('src')).toBe('blob:narration'));
    expect(screen.queryByRole('button', { name: 'Open Narration preview' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Narration'));
    expect(loadPreview).toHaveBeenCalledTimes(1);
  });

  it('retains the explicit preview activation for image references', () => {
    render(<MediaGenerationReferenceCard reference={{ ...reference, kind: 'image' }} source={{ browserUrl: 'blob:thumbnail', loadPreview: vi.fn() }} />);
    expect(screen.getByRole('img', { name: 'Narration' }).getAttribute('src')).toBe('blob:thumbnail');
    expect(screen.getByRole('button', { name: 'Open Narration preview' })).toBeTruthy();
  });

  it('keeps ordinary Studio audio controls directly interactive', () => {
    render(<MediaGenerationReferenceCard reference={{ ...reference, browserUrl: '/media/narration.mp3' }} />);
    expect(screen.getByLabelText('Narration').getAttribute('src')).toBe('/media/narration.mp3');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
