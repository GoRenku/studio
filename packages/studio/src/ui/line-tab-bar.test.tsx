// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
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

  it('keeps disabled items visible and prevents activation', () => {
    const onValueChange = vi.fn();
    render(
      <Tabs defaultValue='shot-plans' onValueChange={onValueChange}>
        <LineTabBar items={[
          { value: 'shot-plans', label: 'Shot Plans' },
          { value: 'generations', label: 'Generations', disabled: true },
        ]} />
      </Tabs>,
    );

    const shotPlans = screen.getByRole('tab', { name: 'Shot Plans' });
    const generations = screen.getByRole('tab', { name: 'Generations' });
    expect(document.body.contains(generations)).toBe(true);
    expect(generations.hasAttribute('disabled')).toBe(true);

    fireEvent.click(generations);
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.focus(shotPlans);
    fireEvent.keyDown(shotPlans, { key: 'ArrowRight' });
    expect(shotPlans.getAttribute('data-state')).toBe('active');
    expect(generations.getAttribute('data-state')).toBe('inactive');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
