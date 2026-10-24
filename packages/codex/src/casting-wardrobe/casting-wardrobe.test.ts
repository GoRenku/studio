import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CastLooksPlanDocument, CastWardrobePlanDocument } from '@gorenku/studio-core/client';
import { createCastingFixture, type CastingFixture } from '../testing/casting-fixture.js';
import type { CastingWardrobeConsumeResult, CastingWardrobePanel } from './contracts.js';

let fixture: CastingFixture;

beforeAll(async () => {
  fixture = await createCastingFixture({ syncModels: false });
});

afterAll(async () => {
  await fixture?.close();
});

function looksDraft(): CastLooksPlanDocument {
  return {
    kind: 'castLooksPlan',
    castMemberId: fixture.castMemberId,
    looks: [
      { id: fixture.looks.young.id, name: 'Young', sceneIds: [fixture.sceneIds[0]!] },
      { id: fixture.looks.older.id, name: 'Older', sceneIds: fixture.sceneIds.slice(1) },
    ],
  };
}

function wardrobeDraft(): CastWardrobePlanDocument {
  return {
    kind: 'castWardrobePlan',
    castMemberId: fixture.castMemberId,
    costumes: [
      { name: 'Harbor coat', lookId: fixture.looks.young.id, wardrobe: ['Wool coat'], continuityNotes: [], sceneIds: [fixture.sceneIds[0]!] },
      { name: 'Armour', lookId: fixture.looks.older.id, wardrobe: ['Plate'], continuityNotes: [], sceneIds: fixture.sceneIds.slice(1) },
    ],
  };
}

async function open(mode: 'looks' | 'costumes', draft: unknown): Promise<CastingWardrobePanel> {
  return (await fixture.call<{ panel: CastingWardrobePanel }>('casting.wardrobe.open', { project: 'movie', mode, castMemberId: fixture.castMemberId, draft })).panel;
}

describe('Looks and wardrobe panel', () => {
  it('exposes respond only to the app and open and consume to the model', async () => {
    const tools = (await fixture.client.listTools()).tools.filter((tool) => tool.name.startsWith('casting.wardrobe.'));
    expect(Object.fromEntries(tools.map((tool) => [tool.name, (tool._meta?.ui as { visibility?: string[] }).visibility]))).toEqual({
      'casting.wardrobe.open': ['model'],
      'casting.wardrobe.respond': ['app'],
      'casting.wardrobe.consume': ['model'],
    });
  });

  it('opens a Looks draft on the scene strip with the saved Looks', async () => {
    const panel = await open('looks', looksDraft());
    expect(panel).toMatchObject({ mode: 'looks', castMember: { id: fixture.castMemberId, name: 'Ana Komnene' }, draft: looksDraft(), answer: null });
    expect(panel.scenes.map((scene) => scene.id)).toEqual(fixture.sceneIds);
    expect(panel.looks.map((look) => [look.name, look.castImageUri])).toEqual([['Young', null], ['Older', null]]);
  });

  it('checks only the draft shape and owner, not scene coverage', async () => {
    expect((await fixture.callError('casting.wardrobe.open', { project: 'movie', mode: 'costumes', castMemberId: fixture.castMemberId, draft: looksDraft() })).error.code).toBe('CODEX_CASTING_WARDROBE_INVALID');
    expect((await fixture.callError('casting.wardrobe.open', { project: 'movie', mode: 'looks', castMemberId: fixture.castMemberId, draft: { ...looksDraft(), castMemberId: 'cast_other' } })).error.code).toBe('CODEX_CASTING_WARDROBE_INVALID');
    const overlapping = { ...looksDraft(), looks: looksDraft().looks.map((look) => ({ ...look, sceneIds: fixture.sceneIds })) };
    expect((await open('looks', overlapping)).draft).toEqual(overlapping);
  });

  it('returns the edited draft once and never writes Looks', async () => {
    const panel = await open('looks', looksDraft());
    const edited = { ...looksDraft(), looks: [{ ...looksDraft().looks[0]!, sceneIds: fixture.sceneIds.slice(0, 2) }, { ...looksDraft().looks[1]!, sceneIds: [fixture.sceneIds[2]!] }] };
    const answered = (await fixture.call<{ panel: CastingWardrobePanel }>('casting.wardrobe.respond', { panelId: panel.panelId, choice: { kind: 'send', draft: edited } })).panel;
    expect(answered.answer).toEqual({ kind: 'send', draft: edited });
    expect((await fixture.callError('casting.wardrobe.respond', { panelId: panel.panelId, choice: { kind: 'canceled' } })).error.code).toBe('CODEX_CASTING_WARDROBE_INVALID');
    expect(await fixture.call<CastingWardrobeConsumeResult>('casting.wardrobe.consume', { panelId: panel.panelId })).toEqual({ status: 'sent', panelId: panel.panelId, mode: 'looks', draft: edited });
    expect(await fixture.call<CastingWardrobeConsumeResult>('casting.wardrobe.consume', { panelId: panel.panelId })).toEqual({ status: 'alreadyConsumed', panelId: panel.panelId });
    const saved = await fixture.service.showCastLooks({ homeDir: fixture.homeDir, projectName: 'movie', castMemberId: fixture.castMemberId });
    expect(saved.looks.find((look) => look.id === fixture.looks.young.id)?.sceneIds).toEqual([fixture.sceneIds[0]]);
  });

  it('opens a wardrobe draft and refuses an edited draft of the other kind', async () => {
    const panel = await open('costumes', wardrobeDraft());
    expect(panel).toMatchObject({ mode: 'costumes', sheetPickedCostumeIds: [] });
    expect((await fixture.callError('casting.wardrobe.respond', { panelId: panel.panelId, choice: { kind: 'send', draft: looksDraft() } })).error.code).toBe('CODEX_CASTING_WARDROBE_INVALID');
    await fixture.call('casting.wardrobe.respond', { panelId: panel.panelId, choice: { kind: 'canceled' } });
    expect(await fixture.call<CastingWardrobeConsumeResult>('casting.wardrobe.consume', { panelId: panel.panelId })).toEqual({ status: 'canceled', panelId: panel.panelId });
    expect((await fixture.service.showCastWardrobe({ homeDir: fixture.homeDir, projectName: 'movie', castMemberId: fixture.castMemberId })).costumes).toEqual([]);
  });
});
