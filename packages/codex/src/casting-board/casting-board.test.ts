import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssetFile } from '@gorenku/studio-core/client';
import { createCastingFixture, type CastingFixture } from '../testing/casting-fixture.js';
import type { CastingBoardConsumeResult, CastingBoardReceipt, CastingCandidateBoard, CastingSheetBoard } from './contracts.js';

let fixture: CastingFixture;
let roundId: string;
let first: AssetFile;
let second: AssetFile;

beforeAll(async () => {
  fixture = await createCastingFixture();
  roundId = await fixture.createRound(fixture.looks.young.id);
  first = await fixture.importCandidate(roundId, 'acme-portrait');
  second = await fixture.importCandidate(roundId, 'acme-faces');
});

afterAll(async () => {
  await fixture?.close();
});

async function openCandidates(): Promise<CastingCandidateBoard> {
  return (await fixture.call<{ session: CastingCandidateBoard }>('casting.board.open', { project: 'movie', mode: 'candidates', lookId: fixture.looks.young.id })).session;
}

async function act(sessionId: string, action: Record<string, unknown>): Promise<CastingBoardReceipt> {
  return fixture.call<CastingBoardReceipt>('casting.board.act', { sessionId, action });
}

async function readBoard<T>(sessionId: string): Promise<T> {
  const resource = await fixture.client.readResource({ uri: `renku-casting-board://${sessionId}` });
  return JSON.parse((resource.contents[0] as { text: string }).text) as T;
}

async function candidateStatuses() {
  const { rounds } = await fixture.service.showCastingLook({ homeDir: fixture.homeDir, projectName: 'movie', lookId: fixture.looks.young.id });
  return Object.fromEntries(rounds.flatMap((round) => round.candidates).map((candidate) => [candidate.assetFileId, candidate.status]));
}

describe('Casting board', () => {
  it('exposes act and request only to the app and open and consume to the model', async () => {
    const tools = (await fixture.client.listTools()).tools.filter((tool) => tool.name.startsWith('casting.board.'));
    expect(Object.fromEntries(tools.map((tool) => [tool.name, (tool._meta?.ui as { visibility?: string[] }).visibility]))).toEqual({
      'casting.board.open': ['model'],
      'casting.board.act': ['app'],
      'casting.board.request': ['app'],
      'casting.board.consume': ['model'],
    });
  });

  it('requires the id that belongs to the mode', async () => {
    expect((await fixture.client.callTool({ name: 'casting.board.open', arguments: { project: 'movie', mode: 'candidates', castMemberId: fixture.castMemberId } })).isError).toBe(true);
  });

  it('shows rounds with their candidates, models and pending counts, and fills in on re-read', async () => {
    const board = await openCandidates();
    expect(board).toMatchObject({ mode: 'candidates', castMember: { name: 'Ana Komnene' }, look: { id: fixture.looks.young.id, name: 'Young', castAssetFileId: null }, action: null });
    expect(board.rounds).toHaveLength(1);
    expect(board.rounds[0]!.candidates.map((candidate) => [candidate.assetFileId, candidate.model.name])).toEqual([[first.id, 'Acme Portrait'], [second.id, 'Acme Faces']]);
    expect(board.rounds[0]!.pending).toEqual([{ model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 1 }]);
    const media = await fixture.client.readResource({ uri: board.rounds[0]!.candidates[0]!.imageUri });
    expect(media.contents[0]).toMatchObject({ blob: expect.any(String) });

    const third = await fixture.importCandidate(roundId, 'acme-portrait');
    const refreshed = await readBoard<CastingCandidateBoard>(board.sessionId);
    expect(refreshed.rounds[0]!.candidates.map((candidate) => candidate.assetFileId)).toContain(third.id);
    expect(refreshed.rounds[0]!.pending).toEqual([]);
  });

  it('saves hide and restore through Core without a request', async () => {
    const board = await openCandidates();
    await act(board.sessionId, { kind: 'hide', assetFileId: second.id });
    expect(await candidateStatuses()).toMatchObject({ [first.id]: 'candidate', [second.id]: 'hidden' });
    const restored = await act(board.sessionId, { kind: 'restore', assetFileId: second.id });
    expect(restored.actionId).toBeNull();
    expect(restored.session.action).toBeNull();
    expect((await candidateStatuses())[second.id]).toBe('candidate');
  });

  it('refuses candidates that are not on the board and actions of the other mode', async () => {
    const board = await openCandidates();
    const otherRound = await fixture.createRound(fixture.looks.older.id);
    const other = await fixture.importCandidate(otherRound, 'acme-faces');
    expect((await fixture.callError('casting.board.act', { sessionId: board.sessionId, action: { kind: 'hide', assetFileId: other.id } })).error.code).toBe('CODEX_CASTING_BOARD_INVALID');
    expect((await fixture.callError('casting.board.act', { sessionId: board.sessionId, action: { kind: 'pickSheet', costumeId: 'costume_x', assetFileId: first.id } })).error.code).toBe('CODEX_CASTING_BOARD_INVALID');
  });

  it('sends "more like these" once with the kept candidate ids and notes', async () => {
    const board = await openCandidates();
    for (const candidate of board.rounds.flatMap((round) => round.candidates).filter((entry) => entry.assetFileId !== first.id)) {
      await act(board.sessionId, { kind: 'hide', assetFileId: candidate.assetFileId });
    }
    expect((await fixture.callError('casting.board.consume', { sessionId: board.sessionId })).error.code).toBe('CODEX_CASTING_BOARD_INVALID');
    const receipt = await fixture.call<CastingBoardReceipt>('casting.board.request', { sessionId: board.sessionId, request: { kind: 'moreLikeKept', notes: '  Keep the eyes.  ' } });
    expect(receipt.actionId).toEqual(expect.any(String));
    expect(receipt.session.action).toMatchObject({ actionId: receipt.actionId, kind: 'moreLikeKept', status: 'pending' });
    expect((await fixture.callError('casting.board.request', { sessionId: board.sessionId, request: { kind: 'moreLikeKept', notes: '' } })).error.code).toBe('CODEX_CASTING_BOARD_BUSY');

    expect(await fixture.call<CastingBoardConsumeResult>('casting.board.consume', { sessionId: board.sessionId })).toEqual({
      status: 'consumed', sessionId: board.sessionId,
      request: { kind: 'moreLikeKept', lookId: fixture.looks.young.id, referenceAssetFileIds: [first.id], notes: 'Keep the eyes.' },
    });
    expect(await fixture.call<CastingBoardConsumeResult>('casting.board.consume', { sessionId: board.sessionId })).toEqual({ status: 'alreadyConsumed', sessionId: board.sessionId });
    expect((await readBoard<CastingCandidateBoard>(board.sessionId)).lastCompletedAction).toEqual({ actionId: receipt.actionId, kind: 'moreLikeKept' });
  });

  it('refuses "more like these" when every candidate is hidden', async () => {
    const board = await openCandidates();
    for (const candidate of board.rounds.flatMap((round) => round.candidates)) {
      await act(board.sessionId, { kind: 'hide', assetFileId: candidate.assetFileId });
    }
    expect((await fixture.callError('casting.board.request', { sessionId: board.sessionId, request: { kind: 'moreLikeKept', notes: '' } })).error.code).toBe('CODEX_CASTING_BOARD_INVALID');
  });

  it('casts a candidate for the Look through Core and waits for the agent', async () => {
    const board = await openCandidates();
    const receipt = await act(board.sessionId, { kind: 'cast', assetFileId: second.id });
    expect((receipt.session as CastingCandidateBoard).look.castAssetFileId).toBe(second.id);
    const { look } = await fixture.service.showCastingLook({ homeDir: fixture.homeDir, projectName: 'movie', lookId: fixture.looks.young.id });
    expect(look.castCandidateAssetFileId).toBe(second.id);
    expect(await fixture.call<CastingBoardConsumeResult>('casting.board.consume', { sessionId: board.sessionId })).toEqual({
      status: 'consumed', sessionId: board.sessionId, request: { kind: 'cast', lookId: fixture.looks.young.id, assetFileId: second.id },
    });
  });

  it('picks a sheet per costume through Core and sends the picks', async () => {
    const { costumes } = await fixture.service.writeCastWardrobePlan({
      homeDir: fixture.homeDir, projectName: 'movie',
      document: { kind: 'castWardrobePlan', castMemberId: fixture.castMemberId, costumes: [
        { name: 'Harbor coat', lookId: fixture.looks.young.id, wardrobe: ['Wool coat'], continuityNotes: [], sceneIds: [fixture.sceneIds[0]!] },
        { name: 'Armour', lookId: fixture.looks.older.id, wardrobe: ['Plate'], continuityNotes: [], sceneIds: fixture.sceneIds.slice(1) },
      ] },
    });
    await fs.writeFile(path.join(fixture.projectFolder, 'tmp', 'sheet.png'), 'sheet');
    const sheet = (await fixture.service.attachGenerationMedia({
      homeDir: fixture.homeDir, projectName: 'movie', purpose: 'cast.character-sheet', target: { kind: 'castCostume', id: costumes[0]!.id }, sourceProjectRelativePath: 'tmp/sheet.png',
    } as never)).assetFile as AssetFile;

    const board = (await fixture.call<{ session: CastingSheetBoard }>('casting.board.open', { project: 'movie', mode: 'sheets', castMemberId: fixture.castMemberId })).session;
    expect(board.costumes.map((costume) => costume.name)).toEqual(['Harbor coat', 'Armour']);
    expect(board.sheets.map((entry) => entry.assetFileId)).toContain(sheet.id);
    expect(board.looks.find((look) => look.id === fixture.looks.young.id)?.castImageUri).toEqual(expect.any(String));

    const picked = await act(board.sessionId, { kind: 'pickSheet', costumeId: costumes[0]!.id, assetFileId: sheet.id });
    expect((picked.session as CastingSheetBoard).costumes[0]!.pickedAssetFileId).toBe(sheet.id);
    expect((await fixture.callError('casting.board.request', { sessionId: board.sessionId, request: { kind: 'moreLikeKept', notes: '' } })).error.code).toBe('CODEX_CASTING_BOARD_INVALID');
    await fixture.call('casting.board.request', { sessionId: board.sessionId, request: { kind: 'sheetPicksDone' } });
    expect(await fixture.call<CastingBoardConsumeResult>('casting.board.consume', { sessionId: board.sessionId })).toEqual({
      status: 'consumed', sessionId: board.sessionId, request: { kind: 'sheetPicksDone', picks: [{ costumeId: costumes[0]!.id, assetFileId: sheet.id }] },
    });
  });
});
