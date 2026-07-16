// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GenerationRequestControlsPanel } from './generation-request-controls-panel';

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('GenerationRequestControlsPanel', () => {
  it('edits model numbers, booleans, and optional text inputs', () => {
    const onChange = vi.fn();
    const onModelChange = vi.fn();
    render(
      <GenerationRequestControlsPanel
        disabled={false}
        model={{
          value: 'fal-ai/nano-banana-2',
          options: [
            {
              value: 'fal-ai/nano-banana-2',
              label: 'Nano Banana 2 — nano-banana-2',
            },
            {
              value: 'fal-ai/openai/gpt-image-2',
              label: 'GPT Image 2 — openai/gpt-image-2',
            },
          ],
          onChange: onModelChange,
        }}
        controls={[
          {
            controlId: 'num_images',
            kind: 'number',
            label: 'Number of Images',
            value: 1,
            required: false,
            min: 1,
            max: 4,
          },
          {
            controlId: 'enable_web_search',
            kind: 'toggle',
            label: 'Enable Web Search',
            value: false,
            required: false,
          },
          {
            controlId: 'seed',
            kind: 'text',
            label: 'Seed',
            value: null,
            required: false,
          },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Model' }));
    fireEvent.click(
      screen.getByRole('option', {
        name: 'GPT Image 2 — openai/gpt-image-2',
      })
    );
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Number of Images' }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Web Search' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Seed' }), {
      target: { value: 'continuity-seed' },
    });

    expect(onModelChange).toHaveBeenCalledWith('fal-ai/openai/gpt-image-2');
    expect(onChange).toHaveBeenCalledWith('num_images', 3);
    expect(onChange).toHaveBeenCalledWith('enable_web_search', true);
    expect(onChange).toHaveBeenCalledWith('seed', 'continuity-seed');
  });
});
