// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SyntaxTextEditor } from './syntax-text-editor';

describe('SyntaxTextEditor', () => {
  it('edits Markdown text through its accessible textbox', () => {
    const onValueChange = vi.fn();
    renderEditor({ onValueChange });

    fireEvent.input(screen.getByRole('textbox', { name: 'Prompt editor' }), {
      target: { value: '# Updated prompt' },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      '# Updated prompt',
      expect.anything()
    );
  });

  it('marks the editor textbox read-only', () => {
    renderEditor({ readOnly: true });

    expect(
      (
        screen.getByRole('textbox', {
          name: 'Prompt editor',
        }) as HTMLTextAreaElement
      ).readOnly
    ).toBe(true);
  });
});

function renderEditor(input: {
  readOnly?: boolean;
  onValueChange?: (value: string) => void;
}) {
  return render(
    <SyntaxTextEditor
      value="# Prompt"
      onValueChange={input.onValueChange ?? (() => {})}
      language="markdown"
      readOnly={input.readOnly}
      ariaLabel="Prompt editor"
    />
  );
}
