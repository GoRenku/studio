// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteChooser as RouteChooserSession, RouteRespondInput } from '@gorenku/studio-codex/route-choice';
import { RouteChooser } from './route-chooser';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  chooser: undefined as unknown,
  connect: vi.fn(), respond: vi.fn(), notify: vi.fn(),
}));

vi.mock('@/services/codex-route-choice', () => ({
  createRouteChooserApp: () => integration.bridge,
  connectRouteChooserApp: integration.connect,
  respondToRouteChooser: integration.respond,
  notifyRouteChoice: integration.notify,
}));

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

beforeEach(() => {
  vi.clearAllMocks();
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { chooser: integration.chooser } });
  });
  integration.respond.mockImplementation(async (_bridge, input: RouteRespondInput) => ({ ...(integration.chooser as RouteChooserSession), revision: 2, answer: input.choice }));
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Fictional providers and model families: the panel renders whatever the chooser lists.
function chooserFixture(overrides: Partial<RouteChooserSession> = {}): RouteChooserSession {
  return {
    choiceId: 'choice',
    revision: 1,
    lane: 'imageEdit',
    laneLabel: 'Image Editing',
    purpose: 'image.edit',
    providers: [
      { provider: 'acme-cloud', label: 'Acme Cloud', available: true, models: [
        { key: 'acme-retouch', name: 'Acme Retouch', recommended: true },
        { key: 'acme-restyle', name: 'Acme Restyle', recommended: false },
      ] },
      { provider: 'acme-locked', label: 'Acme Locked', available: false, models: [{ key: 'acme-retouch', name: 'Acme Retouch', recommended: false }] },
      { provider: 'acme-host', label: 'Acme Host', available: true, models: [{ key: 'acme-host-edit', name: 'Acme Host Edit', recommended: true }] },
    ],
    preselected: { provider: 'acme-cloud', model: 'acme-retouch' },
    chooseRouteBeforeGenerating: true,
    answer: null,
    ...overrides,
  };
}

async function openChooser(overrides: Partial<RouteChooserSession> = {}) {
  integration.chooser = chooserFixture(overrides);
  render(<RouteChooser />);
  await screen.findByRole('heading', { name: 'Choose provider and model' });
}

describe('Route Chooser', () => {
  it('preselects the lane default and marks providers without a key', async () => {
    await openChooser();
    expect(screen.getByText('Image Editing')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Provider' }).textContent).toContain('Acme Cloud');
    expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('Acme Retouch · Recommended');
    fireEvent.click(screen.getByRole('combobox', { name: 'Provider' }));
    expect(screen.getByRole('option', { name: 'Acme Locked (API key missing)' }).getAttribute('data-disabled')).not.toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('continues with the default choice and leaves lane settings alone', async () => {
    await openChooser();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });
    expect(integration.respond).toHaveBeenCalledWith(integration.bridge, {
      choiceId: 'choice',
      choice: { kind: 'chosen', provider: 'acme-cloud', model: 'acme-retouch' },
      saveAsLaneDefault: false,
      chooseRouteBeforeGenerating: true,
    });
    expect(integration.notify.mock.calls[0]![2]).toBe('Acme Retouch on Acme Cloud');
    expect(screen.getByText('Chosen for Image Editing')).toBeTruthy();
  });

  it('switches provider to its recommended model and applies both toggles on Continue', async () => {
    await openChooser();
    fireEvent.click(screen.getByRole('combobox', { name: 'Provider' }));
    fireEvent.click(screen.getByRole('option', { name: 'Acme Host' }));
    expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('Acme Host Edit');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Save as Project default for Image Editing' }));
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't ask which provider and model again for Image Editing" }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });
    expect(integration.respond).toHaveBeenCalledWith(integration.bridge, {
      choiceId: 'choice',
      choice: { kind: 'chosen', provider: 'acme-host', model: 'acme-host-edit' },
      saveAsLaneDefault: true,
      chooseRouteBeforeGenerating: false,
    });
  });

  it('starts with "Don\'t ask again" ticked when the lane no longer asks', async () => {
    await openChooser({ chooseRouteBeforeGenerating: false });
    expect(screen.getByRole('checkbox', { name: "Don't ask which provider and model again for Image Editing" }).getAttribute('data-state')).toBe('checked');
  });

  it('cancels and disables Continue when nothing is available', async () => {
    await openChooser({ preselected: null });
    expect(screen.getByText('No provider with a saved API key offers a model for Image Editing.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(integration.respond.mock.calls[0]![1]).toMatchObject({ choice: { kind: 'canceled' } });
    expect(screen.getByText('Provider and model choice canceled.')).toBeTruthy();
  });
});
