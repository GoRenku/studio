// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingCostumesPanel, CastingLooksPanel, CastingWardrobePanel as CastingWardrobePanelSession, CastingWardrobeRespondInput } from '@gorenku/studio-codex/casting-wardrobe';
import { CastingWardrobePanel } from './casting-wardrobe-panel';
import { cycleScene, sceneChanges } from './wardrobe-edits';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  panel: undefined as unknown,
  connect: vi.fn(), respond: vi.fn(), notify: vi.fn(), readMedia: vi.fn(),
}));

vi.mock('@/services/codex-casting-wardrobe', () => ({
  createCastingWardrobeApp: () => integration.bridge,
  connectCastingWardrobeApp: integration.connect,
  respondToCastingWardrobe: integration.respond,
  notifyCastingWardrobe: integration.notify,
}));
vi.mock('@/services/codex-app', () => ({ readCodexAppMediaBlob: integration.readMedia }));

beforeEach(() => {
  vi.clearAllMocks();
  integration.readMedia.mockReturnValue(new Promise(() => {}));
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { panel: integration.panel } });
  });
  integration.respond.mockImplementation(async (_bridge, input: CastingWardrobeRespondInput) => ({ ...(integration.panel as CastingWardrobePanelSession), revision: 2, answer: input.choice }));
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const scenes = [1, 2, 3, 4].map((number) => ({ id: `scene_${number}`, heading: `SCENE ${number}` }));
const stripScenes = scenes.map((scene, index) => ({ id: scene.id, label: String(index + 1) }));
const savedLooks = [
  { id: 'look_young', name: 'Young', sceneIds: ['scene_1', 'scene_2'], castImageUri: null },
  { id: 'look_older', name: 'Older', sceneIds: ['scene_3', 'scene_4'], castImageUri: null },
];

function looksPanel(): CastingLooksPanel {
  return {
    mode: 'looks', panelId: 'plan', revision: 1, castMember: { id: 'cast_1', name: 'Ana' }, scenes, looks: savedLooks, answer: null,
    draft: { kind: 'castLooksPlan', castMemberId: 'cast_1', looks: [
      { id: 'look_young', name: 'Young', sceneIds: ['scene_1', 'scene_2'] },
      { id: 'look_older', name: 'Older', sceneIds: ['scene_3', 'scene_4'] },
    ] },
  };
}

function costumesPanel(): CastingCostumesPanel {
  return {
    mode: 'costumes', panelId: 'plan', revision: 1, castMember: { id: 'cast_1', name: 'Ana' }, scenes, looks: savedLooks, answer: null, sheetPickedCostumeIds: ['costume_coat'],
    draft: { kind: 'castWardrobePlan', castMemberId: 'cast_1', costumes: [
      { id: 'costume_coat', name: 'Harbor coat', lookId: 'look_young', wardrobe: ['Wool coat.'], continuityNotes: [], sceneIds: ['scene_1', 'scene_2'] },
      { name: 'Armour', lookId: 'look_older', wardrobe: ['Plate.'], continuityNotes: [], sceneIds: ['scene_3'] },
      { name: 'Cloak', lookId: 'look_older', wardrobe: ['Grey cloak.'], continuityNotes: [], sceneIds: ['scene_4'] },
    ] },
  };
}

async function openPanel(panel: CastingWardrobePanelSession) {
  integration.panel = panel;
  render(<CastingWardrobePanel />);
  await screen.findByRole('heading', { name: panel.mode === 'looks' ? 'Looks for Ana' : 'Wardrobe plan' });
}

describe('wardrobe edits', () => {
  it('cycles a scene through the allowed groups, then none, keeping screenplay order', () => {
    const groups = [{ name: 'A', sceneIds: ['scene_1'] }, { name: 'B', sceneIds: ['scene_3'] }];
    const once = cycleScene(groups, [0, 1], 'scene_1', stripScenes);
    expect(once.map((group) => group.sceneIds)).toEqual([[], ['scene_1', 'scene_3']]);
    expect(cycleScene(once, [0, 1], 'scene_1', stripScenes).map((group) => group.sceneIds)).toEqual([[], ['scene_3']]);
    expect(cycleScene(groups, [0, 1], 'scene_2', stripScenes).map((group) => group.sceneIds)).toEqual([['scene_1', 'scene_2'], ['scene_3']]);
    expect(cycleScene(groups, [], 'scene_2', stripScenes)).toBe(groups);
  });

  it('summarises moved scenes by their new group', () => {
    const before = [{ name: 'A', sceneIds: ['scene_1', 'scene_2'] }, { name: 'B', sceneIds: [] }];
    const after = [{ name: 'A', sceneIds: [] }, { name: 'B', sceneIds: ['scene_1', 'scene_2'] }];
    expect(sceneChanges(before, after, stripScenes, 'none')).toBe('1 change: scenes 1–2 → B');
    expect(sceneChanges(before, before, stripScenes, 'none')).toBe('no changes');
  });
});

describe('Looks and wardrobe panel', () => {
  it('moves a scene to another Look on click and sends the edited draft', async () => {
    await openPanel(looksPanel());
    fireEvent.click(screen.getByRole('button', { name: 'Look · Scene 2' }));
    expect(screen.getByText('You made 1 change: scene 2 → Older.')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Use these Looks' })); });
    expect(integration.respond).toHaveBeenCalledWith(integration.bridge, { panelId: 'plan', choice: { kind: 'send', draft: { kind: 'castLooksPlan', castMemberId: 'cast_1', looks: [
      { id: 'look_young', name: 'Young', sceneIds: ['scene_1'] },
      { id: 'look_older', name: 'Older', sceneIds: ['scene_2', 'scene_3', 'scene_4'] },
    ] } } });
    expect(integration.notify.mock.calls[0]![2]).toBe('Young (scene 1), Older (scenes 2–4)');
    expect(screen.getByText('Plan sent to the agent.')).toBeTruthy();
  });

  it('moves a costume cell only among the costumes of that scene\'s Look', async () => {
    await openPanel(costumesPanel());
    expect(screen.getByText('Sheet picked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Costume · Scene 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Look · Scene 3' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send plan to agent' })); });
    const sent = integration.respond.mock.calls[0]![1] as CastingWardrobeRespondInput;
    expect(sent.choice.kind === 'send' && 'costumes' in sent.choice.draft && sent.choice.draft.costumes.map((costume) => costume.sceneIds)).toEqual([['scene_1', 'scene_2'], [], ['scene_3', 'scene_4']]);
    expect(integration.notify.mock.calls[0]![2]).toBe('3 costumes over 4 scenes · 1 change: scene 3 → Cloak');
  });

  it('cancels without sending a draft', async () => {
    await openPanel(costumesPanel());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(integration.respond.mock.calls[0]![1]).toEqual({ panelId: 'plan', choice: { kind: 'canceled' } });
    expect(screen.getByText('Plan canceled.')).toBeTruthy();
  });
});
