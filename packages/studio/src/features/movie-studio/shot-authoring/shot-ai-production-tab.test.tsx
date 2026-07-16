// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShotAiProductionTab } from './shot-ai-production-tab';

describe('ShotAiProductionTab', () => {
  it('renders controlled input, model, prompt, setup, and estimate values', () => {
    const onInputModeChange = vi.fn();
    const onModelChange = vi.fn();
    render(
      <ShotAiProductionTab
        models={[
          {
            modelChoice: 'fal-ai/bytedance/seedance-2.0',
            provider: 'fal-ai',
            model: 'bytedance/seedance-2.0',
            label: 'Seedance 2.0',
            supportedInputModes: ['text-only', 'first-frame'],
            duration: { supported: true, values: [4, 5, 6] },
            parameters: [],
          },
        ]}
        setup={{
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: {},
        }}
        finalPrompt={{ prompt: 'Final siege prompt.' }}
        estimate={0.42}
        onInputModeChange={onInputModeChange}
        onModelChange={onModelChange}
        onParameterChange={vi.fn()}
      />
    );

    expect(screen.getByText('Final siege prompt.')).toBeTruthy();
    expect(screen.getByText('$0.42')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'First frame' }));
    expect(onInputModeChange).toHaveBeenCalledWith('first-frame');
    fireEvent.click(screen.getByRole('row', { name: /Seedance 2.0/ }));
    expect(onModelChange).toHaveBeenCalledWith(
      'fal-ai/bytedance/seedance-2.0'
    );
  });
});
