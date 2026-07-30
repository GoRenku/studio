// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GenerationRequestVideoConfigPanel } from './generation-request-video-config-panel';

describe('GenerationRequestVideoConfigPanel', () => {
  it('renders Model, Input, and Setup in order and exposes every video input mode', () => {
    const onInputModeChange = vi.fn();
    const onModelChange = vi.fn();
    const { container } = render(
      <GenerationRequestVideoConfigPanel
        inputModes={[
          { id: 'text-only', label: 'Text only', available: true },
          { id: 'first-frame', label: 'First frame', available: true },
          {
            id: 'first-last-frame',
            label: 'First + last frame',
            available: true,
          },
          { id: 'reference', label: 'Reference', available: true },
        ]}
        inputMode='text-only'
        modelFamilies={[
          {
            familyId: 'seedance-2.0',
            label: 'Seedance 2.0',
            available: true,
            durationCapabilityLabel: '4–15s',
          },
          {
            familyId: 'seedance-2.0-mini',
            label: 'Seedance 2.0 Mini',
            available: true,
            durationCapabilityLabel: '4–15s',
          },
          {
            familyId: 'seedance-2.0-fast',
            label: 'Seedance 2.0 Fast',
            available: true,
            durationCapabilityLabel: '4–15s',
          },
        ]}
        modelFamilyId='seedance-2.0'
        controls={[]}
        disabled={false}
        onInputModeChange={onInputModeChange}
        onModelChange={onModelChange}
        onControlChange={vi.fn()}
      />
    );

    expect(
      Array.from(container.querySelectorAll('section > :first-child')).map(
        (heading) => heading.textContent?.trim(),
      ),
    ).toEqual(['ModelDuration', 'Input', 'Setup']);
    expect(screen.queryByText('Source Video')).toBeNull();
    expect(screen.queryByText('Final prompt')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /Seedance 2\.0 Fast/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'First + last frame' }));

    expect(onModelChange).toHaveBeenCalledWith('seedance-2.0-fast');
    expect(onInputModeChange).toHaveBeenCalledWith('first-last-frame');
  });
});
