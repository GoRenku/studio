// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SaveNotification } from './save-notification';

describe('SaveNotification', () => {
  it('lets users dismiss an error notification', () => {
    render(
      <SaveNotification
        status={{ state: 'error', message: 'Validation failed.' }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss save notification' })
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a dismissed notification again when the message changes', () => {
    const { rerender } = render(
      <SaveNotification
        status={{ state: 'error', message: 'First validation failure.' }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss save notification' })
    );
    rerender(
      <SaveNotification
        status={{ state: 'error', message: 'Second validation failure.' }}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'Second validation failure.'
    );
  });

  it('keeps the full cropped message available on the message trigger', () => {
    const message =
      'PROJECT_DATA421: Scene shot video take state JSON failed validation.';
    render(<SaveNotification status={{ state: 'error', message }} />);

    expect(screen.getByText(message).getAttribute('title')).toBe(message);
  });
});
