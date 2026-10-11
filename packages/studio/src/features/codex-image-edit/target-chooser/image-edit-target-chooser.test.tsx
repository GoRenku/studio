// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageEditTargetChooser as ImageEditTargetChooserSession, ImageEditTargetRespondInput } from '@gorenku/studio-codex/image-edit';
import { imageEditTargetChooserFixture } from '../testing/image-edit-session-fixture';
import { ImageEditTargetChooser } from './image-edit-target-chooser';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  chooser: undefined as unknown,
  connect: vi.fn(), readMedia: vi.fn(), respond: vi.fn(), notify: vi.fn(),
}));

vi.mock('@/services/codex-image-edit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/codex-image-edit')>()),
  createImageEditTargetChooserApp: () => integration.bridge,
  connectImageEditTargetChooserApp: integration.connect,
  respondToImageEditTargetChooser: integration.respond,
  notifyImageEditTargetChoice: integration.notify,
}));
vi.mock('@/services/codex-app', () => ({ readCodexAppMediaBlob: integration.readMedia }));

beforeEach(() => {
  vi.clearAllMocks();
  integration.readMedia.mockReturnValue(new Promise(() => {}));
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { chooser: integration.chooser } });
  });
  integration.respond.mockImplementation(async (_bridge, input: ImageEditTargetRespondInput) => ({ ...(integration.chooser as ImageEditTargetChooserSession), revision: 2, choice: input.choice }));
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openChooser() {
  integration.chooser = imageEditTargetChooserFixture();
  render(<ImageEditTargetChooser />);
  await screen.findByRole('heading', { name: 'Choose an image to edit' });
}

describe('Image edit target chooser', () => {
  it('groups candidates by image type with the shared owner in the header and the suggestion chosen', async () => {
    await openChooser();
    expect(screen.getByText('Constantine XI Palaiologos')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Profile image', 'Character sheet']);
    const suggested = screen.getByRole('radio', { name: 'Profile image · Take 3' });
    expect(suggested.getAttribute('aria-checked')).toBe('true');
    expect(within(suggested).getByText('Selected')).toBeTruthy();
  });

  it('records the chosen image once, notifies the conversation and collapses to a confirmation', async () => {
    await openChooser();
    fireEvent.click(screen.getByRole('radio', { name: 'Character sheet · Take 1' }));
    expect(screen.getByText('Character sheet · Take 1', { selector: 'footer span' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Edit this image' })); });
    expect(integration.respond).toHaveBeenCalledWith(integration.bridge, { chooserId: 'chooser', choice: { status: 'chosen', assetFileId: 'sheet-1' } });
    expect(integration.notify.mock.calls[0]![2]).toBe('Constantine XI Palaiologos · Character sheet · Take 1');
    expect(screen.getByText('Chosen for editing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit this image' })).toBeNull();
  });

  it('records a cancel and keeps a failed notification retryable', async () => {
    await openChooser();
    integration.notify.mockRejectedValueOnce(new Error('The host could not notify its conversation.'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(integration.respond).toHaveBeenCalledWith(integration.bridge, { chooserId: 'chooser', choice: { status: 'canceled' } });
    expect(screen.getByText('Image choice canceled.')).toBeTruthy();
    expect(screen.getByText('The host could not notify its conversation.')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry notification' })); });
    expect(integration.notify).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Retry notification' })).toBeNull();
  });
});
