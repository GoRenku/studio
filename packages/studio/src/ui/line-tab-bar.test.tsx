// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { LineTabBar } from './line-tab-bar';
import { Tabs } from './tabs';

describe('LineTabBar', () => {
  it('preserves the approved inset, tab padding, and selected treatment', () => {
    render(
      <Tabs value='prompt'>
        <LineTabBar items={[
          { value: 'prompt', label: 'Prompt' },
          { value: 'references', label: 'References' },
        ]} />
      </Tabs>,
    );

    const tablist = screen.getByRole('tablist');
    const prompt = screen.getByRole('tab', { name: 'Prompt' });

    expect(tablist.className).toContain('!h-[46px]');
    expect(tablist.className).toContain('px-[14px]');
    expect(prompt.className).toContain('px-3');
    expect(prompt.className).toContain('data-[state=active]:!bg-item-active-bg');
    expect(prompt.className).toContain('after:!bottom-0');
  });
});
