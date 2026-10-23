// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentRequest, AgentRequestLine } from './agent-request';

const REQUEST = 'Create a new Renku project and write a one-page scene about [your idea].';

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

describe('AgentRequest', () => {
  afterEach(cleanup);

  it('shows the exact request, tints the words to edit, and confirms a copy', async () => {
    const writeText = vi.fn(async () => {});
    mockClipboard(writeText);
    const { container } = render(<AgentRequest request={REQUEST} />);

    expect(container.textContent).toContain(REQUEST);
    expect(screen.getByText('[your idea]').className).toContain('text-primary');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(writeText).toHaveBeenCalledWith(REQUEST);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('explains a clipboard failure', async () => {
    mockClipboard(vi.fn(async () => {
      throw new Error('denied');
    }));
    render(<AgentRequest request={REQUEST} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(screen.getByRole('alert').textContent).toBe('Unable to copy. Select the text and copy it manually.');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});

describe('AgentRequestLine', () => {
  afterEach(cleanup);

  it('copies the request when the row is clicked', async () => {
    const writeText = vi.fn(async () => {});
    mockClipboard(writeText);
    render(<AgentRequestLine request='Add [character name] to the cast.' />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy request: Add [character name] to the cast.' }));
    });

    expect(writeText).toHaveBeenCalledWith('Add [character name] to the cast.');
    expect(screen.getByRole('button', { name: 'Copied: Add [character name] to the cast.' })).toBeTruthy();
  });
});
