// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReferencePickerDialog } from './reference-picker-dialog';

describe('ReferencePickerDialog', () => {
  it('uses the shared inset collection and keeps whole-card callback choice', () => {
    const onChoose = vi.fn();
    render(
      <ReferencePickerDialog
        open
        onOpenChange={vi.fn()}
        title='Start frame'
        description='Choose the exact Start frame.'
        candidates={[
          {
            id: 'first',
            title: 'First frame',
            imageUrl: '/first.jpg',
            imageAlt: 'First frame image',
            selected: false,
          },
          {
            id: 'second',
            title: 'Second frame',
            imageUrl: '/second.jpg',
            imageAlt: 'Second frame image',
            selected: true,
          },
        ]}
        onChoose={onChoose}
      />
    );

    expect(
      screen
        .getByRole('dialog')
        .getAttribute('data-media-card-collection-presentation')
    ).toBe('inset');
    fireEvent.click(screen.getByRole('button', { name: 'First frame' }));
    expect(onChoose).toHaveBeenCalledWith('first');
    expect(screen.queryByLabelText('Close image preview')).toBeNull();
  });
});
