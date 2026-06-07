// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/ui/button';
import { PanelShell } from './panel-shell';

describe('PanelShell', () => {
  it('renders commands before the save notification in the details header trailing area', () => {
    render(
      <PanelShell
        title='Scene Details'
        action={
          <Button type='button' variant='outline' size='sm'>
            Editing Groups
          </Button>
        }
        saveNotification={{ state: 'error', message: 'Validation failed.' }}
      >
        <p>Scene content</p>
      </PanelShell>
    );

    const command = screen.getByRole('button', { name: 'Editing Groups' });
    const notification = screen.getByRole('alert');

    expect(notification.textContent).toContain('Validation failed.');
    expect(
      command.compareDocumentPosition(notification) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
