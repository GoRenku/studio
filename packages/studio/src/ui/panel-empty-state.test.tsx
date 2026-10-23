// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { PanelEmptyState } from './panel-empty-state';

describe('PanelEmptyState', () => {
  afterEach(cleanup);

  it('shows the title, description, requests and the paste hint', () => {
    render(
      <PanelEmptyState
        icon={Users}
        title='No cast yet'
        description='Your agent can read the screenplay and create a Cast Member for each character.'
        request='Cast the main characters from my screenplay.'
        moreRequests={['Add [character name] to the cast.']}
      />
    );

    expect(screen.getByRole('heading', { name: 'No cast yet' })).toBeTruthy();
    expect(screen.getByText('Cast the main characters from my screenplay.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy request: Add [character name] to the cast.' })).toBeTruthy();
    expect(screen.getByText('Paste into Claude or Codex. Studio updates while your agent works.')).toBeTruthy();
  });

  it('leaves out the paste hint when there is nothing to ask', () => {
    render(<PanelEmptyState title='No inspiration yet' description='Create a folder to collect references.' />);

    expect(screen.queryByText(/Paste into Claude or Codex/)).toBeNull();
  });
});
