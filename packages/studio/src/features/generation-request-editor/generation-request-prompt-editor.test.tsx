// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationRequestPromptEditor } from './generation-request-prompt-editor';

const mentions = [
  {
    value: '@Reference1',
    label: 'Council chamber',
    previewImageUrl: '/studio-api/reference-1.png',
  },
  {
    value: '@Reference2',
    label: 'Imperial lookbook',
    previewImageUrl: '/studio-api/reference-2.png',
  },
];

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'execCommand');
  Reflect.deleteProperty(document, 'caretRangeFromPoint');
});

describe('GenerationRequestPromptEditor', () => {
  it('replaces only the active partial query with one ordinary editor insertion', () => {
    const onValueChange = vi.fn();
    const execCommand = vi.fn(
      (_command, _showUi, replacement) => {
        const textarea = document.activeElement as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const inserted = String(replacement).replace(/\n$/, '');
        textarea.value = textarea.value.slice(0, start) + inserted +
          textarea.value.slice(end);
        textarea.setSelectionRange(start + inserted.length, start + inserted.length);
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: inserted }));
        return true;
      },
    );
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    render(
      <GenerationRequestPromptEditor
        value='Use @Ref beside @Unknown.'
        onValueChange={onValueChange}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    const textarea = screen.getByLabelText('Generation prompt') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(8, 8);
    fireEvent(textarea, new Event('selectionchange', { bubbles: true }));

    expect(screen.getByRole('listbox', { name: 'Selected image references' })).toBeTruthy();
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('Use @Reference1 beside @Unknown.');
    expect(textarea.selectionStart).toBe('Use @Reference1'.length);
  });

  it('previews the exact known mention under the pointer in read-only text', () => {
    const { container } = render(
      <GenerationRequestPromptEditor
        value='Use @Reference1 beside @Reference2.'
        onValueChange={() => {}}
        mentions={mentions}
        readOnly
        ariaLabel='Generation prompt'
      />,
    );
    const textNode = findTextNode(container, 'Use @Reference1 beside @Reference2.');
    const offset = textNode.textContent!.indexOf('@Reference2') + 3;
    const range = document.createRange();
    range.setStart(textNode, offset);
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => range,
    });

    act(() => {
      fireEvent.mouseMove(container.firstElementChild!.firstElementChild!, {
        clientX: 100,
        clientY: 100,
      });
    });

    expect(
      screen.getByRole('img', { name: 'Imperial lookbook' }).getAttribute('src'),
    ).toBe('/studio-api/reference-2.png');
  });
});

function findTextNode(root: HTMLElement, text: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.includes(text)) return node as Text;
    node = walker.nextNode();
  }
  throw new Error(`Expected rendered editor text: ${text}`);
}
