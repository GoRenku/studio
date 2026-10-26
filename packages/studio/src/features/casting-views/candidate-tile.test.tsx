// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CandidateTile } from './candidate-tile';

describe('CandidateTile', () => {
  it('shows the image and model with no actions when no callbacks are passed', () => {
    render(<CandidateTile imageUrl='/a.png' modelLabel='Lumen Image' status='candidate' isCast={false} />);

    expect(screen.getByRole('img', { name: 'Casting candidate from Lumen Image' }).getAttribute('src')).toBe('/a.png');
    expect(screen.getByText('Lumen Image')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('calls hide, cast and open', () => {
    const onHide = vi.fn();
    const onCast = vi.fn();
    const onOpen = vi.fn();
    render(<CandidateTile imageUrl='/a.png' status='candidate' isCast={false} onHide={onHide} onCast={onCast} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open casting candidate' }));

    expect([onHide, onCast, onOpen].map((callback) => callback.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('offers to show a hidden candidate again', () => {
    render(<CandidateTile imageUrl='/a.png' status='hidden' isCast={false} onHide={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Show again' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the cast candidate instead of offering Cast', () => {
    render(<CandidateTile imageUrl='/a.png' status='candidate' isCast onCast={vi.fn()} />);

    expect(screen.getByText('Cast').tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: 'Cast' })).toBeNull();
  });

  it('shows a pending candidate as a placeholder with its label', () => {
    render(<CandidateTile status='candidate' isCast={false} pending={{ label: 'Generating' }} onCast={vi.fn()} />);

    expect(screen.getByText('Generating')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
