// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs } from '@/ui/tabs';
import { ImageRevisionModeTabs } from './image-revision-mode-tabs';

describe('ImageRevisionModeTabs', () => {
  it('makes an unavailable Regenerate mode explicit', () => {
    render(
      <Tabs defaultValue='edit'>
        <ImageRevisionModeTabs
          regenerateAvailable={false}
          regenerateUnavailableReason='This image has no original generation request.'
          disabled={false}
        />
      </Tabs>,
    );

    expect(
      screen.getByRole('tab', { name: 'Regenerate' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText('Why Regenerate is unavailable')).toBeTruthy();
  });
});
