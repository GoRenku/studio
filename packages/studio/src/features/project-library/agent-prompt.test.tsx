// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentPrompt } from './agent-prompt';

const PROMPT = 'Create a new Renku project and write a one-page scene about [your idea].';

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

describe('AgentPrompt', () => {
  afterEach(cleanup);

  it('shows the exact read-only request and confirms a copy', async () => {
    const writeText = vi.fn(async () => {});
    mockClipboard(writeText);
    render(<AgentPrompt label='Scene writing request' prompt={PROMPT} />);

    const textbox = screen.getByRole('textbox', { name: 'Scene writing request' }) as HTMLTextAreaElement;
    expect(textbox.value).toBe(PROMPT);
    expect(textbox.readOnly).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(writeText).toHaveBeenCalledWith(PROMPT);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('explains a clipboard failure', async () => {
    mockClipboard(vi.fn(async () => {
      throw new Error('denied');
    }));
    render(<AgentPrompt label='Scene writing request' prompt={PROMPT} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(screen.getByRole('alert').textContent).toBe('Unable to copy. Select the text and copy it manually.');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});
