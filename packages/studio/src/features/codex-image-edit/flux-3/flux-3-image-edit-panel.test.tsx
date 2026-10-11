// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flux3ImageEditDraft, ImageEditSession } from '@gorenku/studio-codex/image-edit';
import { imageEditSessionFixture, imageEditVersionFixture } from '../testing/image-edit-session-fixture';
import { Flux3ImageEditPanel } from './flux-3-image-edit-panel';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  session: undefined as unknown,
  connect: vi.fn(), readMedia: vi.fn(), generate: vi.fn(), notify: vi.fn(), read: vi.fn(),
}));

vi.mock('@/services/codex-image-edit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/codex-image-edit')>()),
  createImageEditApp: () => integration.bridge,
  connectImageEditApp: integration.connect,
  generateImageEdit: integration.generate,
  notifyImageEditGenerate: integration.notify,
  readImageEditSession: integration.read,
}));
vi.mock('@/services/codex-app', () => ({ readCodexAppMediaBlob: integration.readMedia }));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.PointerEvent ??= class extends MouseEvent { pointerId = 1; } as unknown as typeof PointerEvent;
  integration.readMedia.mockReturnValue(new Promise(() => {}));
  integration.read.mockImplementation(async () => integration.session);
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session: integration.session } });
  });
  integration.generate.mockImplementation(async (_bridge, { draft }: { draft: Flux3ImageEditDraft }) => {
    const session = integration.session as ImageEditSession;
    return { sessionId: session.sessionId, actionId: 'action', session: { ...session, revision: 2, action: { actionId: 'action', baseAssetFileId: draft.baseAssetFileId, status: 'pending' } } };
  });
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openPanel(session: ImageEditSession) {
  integration.session = session;
  render(<Flux3ImageEditPanel />);
  await screen.findByRole('heading', { name: session.owner.name ?? 'Profile image' });
}

function drawRegion(from: [number, number], to: [number, number]) {
  const canvas = screen.getByTestId('region-canvas');
  canvas.getBoundingClientRect = () => ({ top: 0, left: 0, width: 500, height: 500, bottom: 500, right: 500, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

function generateButton() {
  return screen.getByRole('button', { name: 'Generate' });
}

describe('FLUX 3 image edit panel', () => {
  it('shows the owner, image type, model and source version, and explains why Generate waits', async () => {
    await openPanel(imageEditSessionFixture());
    expect(screen.getByText('Cast · Profile image')).toBeTruthy();
    expect(screen.getByText('FLUX 3 Image · Fal.ai')).toBeTruthy();
    const strip = screen.getByRole('navigation', { name: 'Versions' });
    expect(within(strip).getByRole('button', { name: 'Take 3' }).textContent).toContain('Selected');
    expect(generateButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Describe a change or mark a region.')).toBeTruthy();
  });

  it('draws numbered regions, requires an Edit instruction and sends the draft on the 0–1000 grid', async () => {
    await openPanel(imageEditSessionFixture());
    drawRegion([135, 10], [365, 145]);
    expect(screen.getByRole('textbox', { name: 'Region 1 instruction' })).toBe(document.activeElement);
    expect(screen.getByText('Region 1 needs an instruction, or set it to Remove.')).toBeTruthy();
    expect(generateButton()).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Region 1 instruction' }), { target: { value: 'Replace the crown with the helmet from Props.' } });

    drawRegion([0, 20], [64, 274]);
    fireEvent.click(within(screen.getByRole('group', { name: 'Region 2 action' })).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Resolution' })).getByRole('button', { name: '4K' }));
    expect(screen.getByText('Edits Take 3 · ⌘↵')).toBeTruthy();

    await act(async () => { fireEvent.click(generateButton()); });
    expect(integration.generate.mock.calls[0]![1].draft).toEqual({
      panel: 'flux-3', baseAssetFileId: 'profile-3', wholeImageInstruction: '', styleReferenceAssetFileId: null, resolution: '4k',
      regions: [
        { number: 1, mode: 'edit', box: { top: 20, left: 270, bottom: 290, right: 730 }, instruction: 'Replace the crown with the helmet from Props.' },
        { number: 2, mode: 'remove', box: { top: 40, left: 0, bottom: 548, right: 128 }, instruction: '' },
      ],
    });
    expect(integration.notify.mock.calls[0]![2]).toBe('Constantine XI Palaiologos · Profile image Take 3');
    expect(integration.notify.mock.calls[0]![3]).toBe('I approve uploading this image and any references it needs to Fal.ai and running one paid FLUX 3 Image Edit at 4K with my saved Fal.ai key.');
    expect(screen.getByText(/Generate uploads this image and any references it needs to Fal\.ai and runs one paid FLUX 3 Image Edit/)).toBeTruthy();
    expect(screen.getByText('Generating Take 4…', { selector: '[role="status"] *, [role="status"]' })).toBeTruthy();
  });

  it('treats a tiny drag as a click and deletes the selected region with the keyboard', async () => {
    await openPanel(imageEditSessionFixture());
    drawRegion([10, 10], [12, 12]);
    expect(screen.queryByRole('textbox', { name: 'Region 1 instruction' })).toBeNull();
    drawRegion([100, 100], [300, 300]);
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(screen.queryByRole('textbox', { name: 'Region 1 instruction' })).toBeNull();
  });

  it('adds a style reference from the visual language and sends the whole-image instruction', async () => {
    await openPanel(imageEditSessionFixture({ initial: { wholeImageInstruction: 'Colder light.', resolution: '2k' } }));
    fireEvent.click(screen.getByRole('button', { name: 'From visual language' }));
    expect(screen.getByText('Production lookbook', { selector: 'h2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Loose sketch style' }));
    expect(screen.getByText('Storyboard lookbook')).toBeTruthy();
    await act(async () => { fireEvent.click(generateButton()); });
    expect(integration.generate.mock.calls[0]![1].draft).toMatchObject({ wholeImageInstruction: 'Colder light.', styleReferenceAssetFileId: 'style-sketch', regions: [] });
  });

  it('shows a reported edit with its comparison and keeps later edits on the selected version', async () => {
    const reported = imageEditSessionFixture({
      revision: 3,
      versions: [imageEditVersionFixture('profile-3', 3), imageEditVersionFixture('profile-4', 4, { parentAssetFileId: 'profile-3', selected: true })],
      editBaseAssetFileId: 'profile-4',
      lastCompletedAction: { actionId: 'action', assetFileId: 'profile-4' },
    });
    await openPanel(imageEditSessionFixture({ initial: { wholeImageInstruction: 'Colder light.', resolution: '2k' } }));
    integration.session = reported;
    await act(async () => { integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session: reported } }); });
    expect(screen.getByRole('button', { name: 'Hide comparison' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take 4' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Edits Take 4 · ⌘↵')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Take 3' }));
    expect(screen.getByText(/Viewing Take 3\. New edits start from the selected Take 4\./)).toBeTruthy();
  });

  it('disables Generate when the selectable image has no selection', async () => {
    await openPanel(imageEditSessionFixture({ editBaseAssetFileId: null, versions: [imageEditVersionFixture('profile-3', 3)], initial: { wholeImageInstruction: 'Colder light.', resolution: '2k' } }));
    expect(screen.getByText('No selected image. Select one in Studio.')).toBeTruthy();
    expect(generateButton()).toHaveProperty('disabled', true);
  });
});
