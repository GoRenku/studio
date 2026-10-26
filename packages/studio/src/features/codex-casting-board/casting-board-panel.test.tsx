// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingCandidateBoard, CastingSheetBoard } from '@gorenku/studio-codex/casting-board';
import { loadRenderedImages, stubImageZoomLayout } from '@/ui/testing/image-zoom-layout';
import { CastingBoardPanel } from './casting-board-panel';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  board: undefined as unknown,
  connect: vi.fn(), read: vi.fn(), act: vi.fn(), cast: vi.fn(), request: vi.fn(), notify: vi.fn(), readMedia: vi.fn(),
}));

vi.mock('@/services/codex-casting-board', () => ({
  createCastingBoardApp: () => integration.bridge,
  connectCastingBoardApp: integration.connect,
  readCastingBoard: integration.read,
  actOnCastingBoard: integration.act,
  castOnCastingBoard: integration.cast,
  requestFromCastingBoard: integration.request,
  notifyCastingBoardRequest: integration.notify,
}));
vi.mock('@/services/codex-app', () => ({ readCodexAppMediaBlob: integration.readMedia }));

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:candidate');
  URL.revokeObjectURL = vi.fn();
  integration.readMedia.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session: integration.board } });
  });
  integration.read.mockImplementation(async () => integration.board);
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const portrait = { key: 'acme-portrait', name: 'Acme Portrait' };
const faces = { key: 'acme-faces', name: 'Acme Faces' };
const studio = { key: 'acme-studio', name: 'Acme Studio' };

// Fictional routes only: the board shows whatever models the round recorded.
function candidateBoard(overrides: Partial<CastingCandidateBoard> = {}): CastingCandidateBoard {
  return {
    mode: 'candidates',
    sessionId: 'board',
    revision: 1,
    castMember: { id: 'cast_1', name: 'Ana' },
    look: { id: 'look_1', name: 'Young', castAssetFileId: null },
    rounds: [{
      id: 'round_1', number: 1, expectedCount: 4, estimatedCost: { amount: 0.14, currency: 'USD' },
      routes: [{ provider: 'acme-cloud', model: portrait, count: 3 }, { provider: 'acme-cloud', model: faces, count: 1 }],
      pending: [{ model: portrait, count: 2 }],
      candidates: [
        { assetFileId: 'af_1', status: 'candidate', model: portrait, imageUri: 'renku-casting-board://board/media/1' },
        { assetFileId: 'af_2', status: 'candidate', model: faces, imageUri: 'renku-casting-board://board/media/2' },
      ],
    }],
    action: null,
    lastCompletedAction: null,
    ...overrides,
  };
}

/** Two costumes of Young: Harbor coat (two sheets, one picked) and Riding coat (one sheet, none picked). */
function sheetBoard(overrides: Partial<CastingSheetBoard> = {}): CastingSheetBoard {
  const round = (id: string, sheets: string[]) => ({
    id, number: 1, expectedCount: sheets.length, estimatedCost: null, pending: [],
    routes: [{ provider: 'acme-cloud', model: portrait, count: sheets.length }],
    candidates: sheets.map((assetFileId, index) => ({ assetFileId, status: 'candidate' as const, model: portrait, imageUri: `renku-casting-board://board/media/${assetFileId}-${index}` })),
  });
  return {
    mode: 'sheets', sessionId: 'board', revision: 1, castMember: { id: 'cast_1', name: 'Ana' },
    look: { id: 'look_1', name: 'Young' },
    scenes: [{ id: 'scene_1', heading: 'EXT. HARBOR', productionNumber: '3' }, { id: 'scene_2', heading: 'INT. PALACE' }],
    focusCostumeId: null,
    costumes: [
      { id: 'costume_1', name: 'Harbor coat', sceneIds: ['scene_1'], pickedAssetFileId: 'sheet_1', rounds: [round('round_1', ['sheet_1', 'sheet_3'])] },
      { id: 'costume_2', name: 'Riding coat', sceneIds: ['scene_2'], pickedAssetFileId: null, rounds: [round('round_2', ['sheet_2'])] },
    ],
    action: null, lastCompletedAction: null,
    ...overrides,
  };
}

async function openBoard(board: CastingCandidateBoard | CastingSheetBoard) {
  integration.board = board;
  render(<CastingBoardPanel />);
  await screen.findByRole('heading', { name: board.mode === 'candidates' ? 'Casting board' : 'Character sheets' });
}

describe('Casting board panel', () => {
  it('shows the round, the progress, model labels and pending tiles per model', async () => {
    await openBoard(candidateBoard());
    expect(screen.getByText('2 of 4 in')).toBeTruthy();
    expect(screen.getByText('Acme Portrait ×3 · Acme Faces ×1 · $0.14')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Round 1 progress' })).toBeTruthy();
    expect(screen.getAllByText('Generating · Acme Portrait')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Candidates 4' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Hidden 0' })).toBeTruthy();
    expect(await screen.findByText('Acme Faces', { selector: 'figcaption span' })).toBeTruthy();
  });

  it('casts a candidate from its tile and posts the cast', async () => {
    await openBoard(candidateBoard());
    integration.cast.mockImplementation(async () => {
      const session = candidateBoard({ look: { id: 'look_1', name: 'Young', castAssetFileId: 'af_1' }, action: { actionId: 'action_1', kind: 'cast', status: 'pending' } });
      return { sessionId: 'board', actionId: 'action_1', session };
    });
    await act(async () => { fireEvent.click((await screen.findAllByRole('button', { name: 'Cast' }))[0]!); });
    expect(integration.cast).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', assetFileId: 'af_1' });
    expect(integration.notify.mock.calls[0]![2]).toBe('Look cast · Ana · Young · candidate from round 1 (Acme Portrait)');
  });

  it('hides a candidate and shows it again from the Hidden tab', async () => {
    const board = candidateBoard();
    board.rounds[0]!.candidates[1]!.status = 'hidden';
    await openBoard(board);
    expect(screen.getByRole('tab', { name: 'Candidates 3' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Casting candidate from Acme Faces' })).toBeNull();
    integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: board }));
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Hide' })); });
    expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'hide', assetFileId: 'af_1' } });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Hidden 1' }));
    const showAgain = await screen.findByRole('button', { name: 'Show again' });
    await act(async () => { fireEvent.click(showAgain); });
    expect(integration.act).toHaveBeenLastCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'restore', assetFileId: 'af_2' } });
  });

  it('sends "more like these" with the notes, and needs a kept candidate', async () => {
    await openBoard(candidateBoard());
    integration.request.mockImplementation(async () => ({ sessionId: 'board', actionId: 'action_2', session: candidateBoard({ revision: 3, action: { actionId: 'action_2', kind: 'moreLikeKept', status: 'pending' } }) }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes for the next round' }), { target: { value: 'Leaner face' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More like these' })); });
    expect(integration.request).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', request: { kind: 'moreLikeKept', notes: 'Leaner face' } });
    expect(integration.notify.mock.calls[0]![2]).toBe('More candidates requested · Ana · Young · like 2 kept');
    cleanup();

    const allHidden = candidateBoard();
    allHidden.rounds[0]!.candidates.forEach((candidate) => { candidate.status = 'hidden'; });
    await openBoard(allHidden);
    expect(screen.getByRole('button', { name: 'More like these' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Compare 0' })).toHaveProperty('disabled', true);
  });

  it('shows one costume\'s sheet rounds at a time and picks a sheet with no message', async () => {
    const board = sheetBoard();
    await openBoard(board);
    expect(screen.getByRole('tab', { name: /Riding coat/ }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('tab', { name: /Harbor coat/ }).textContent).toContain('Picked');
    expect(screen.getByRole('tab', { name: 'Sheets 1' })).toBeTruthy();
    expect(screen.queryByText('Send picks to agent')).toBeNull();

    integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: { ...board, revision: 2, costumes: [board.costumes[0]!, { ...board.costumes[1]!, pickedAssetFileId: 'sheet_2' }] } }));
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Pick' })); });
    expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'pickSheet', costumeId: 'costume_2', assetFileId: 'sheet_2' } });
    expect(screen.getByText('2 of 2 picked')).toBeTruthy();
    expect(integration.notify).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Harbor coat/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Harbor coat/ }));
    expect(await screen.findByRole('tab', { name: 'Sheets 2' })).toBeTruthy();
  });

  it('asks for more sheets like the kept ones of the costume shown', async () => {
    await openBoard(sheetBoard({ focusCostumeId: 'costume_1' }));
    integration.request.mockResolvedValue({ sessionId: 'board', actionId: 'action_1', session: sheetBoard({ action: { actionId: 'action_1', kind: 'moreLikeKept', status: 'pending' } }) });
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes for the next round' }), { target: { value: 'Rougher seams' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More like these' })); });
    expect(integration.request).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', request: { kind: 'moreLikeKept', notes: 'Rougher seams', costumeId: 'costume_1' } });
    expect(integration.notify.mock.calls[0]![2]).toBe('More character sheets requested · Ana · Young');
  });

  describe('zoom', () => {
    let restoreLayout: () => void;
    beforeEach(() => { restoreLayout = stubImageZoomLayout({ width: 800, height: 600 }, { width: 1600, height: 1200 }); });
    afterEach(() => { restoreLayout(); });

    const threeKept = () => {
      const board = candidateBoard();
      board.rounds[0]!.pending = [];
      board.rounds[0]!.candidates = [
        { assetFileId: 'af_1', status: 'candidate', model: portrait, imageUri: 'renku-casting-board://board/media/1' },
        { assetFileId: 'af_2', status: 'candidate', model: faces, imageUri: 'renku-casting-board://board/media/2' },
        { assetFileId: 'af_3', status: 'candidate', model: studio, imageUri: 'renku-casting-board://board/media/3' },
      ];
      return board;
    };

    it('opens a candidate large to zoom and keeps hide and cast in the zoom pill', async () => {
      await openBoard(candidateBoard());
      await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Open casting candidate from acme faces' })); });
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();
      const pill = within(viewer).getByRole('toolbar', { name: 'Zoom' });
      fireEvent.click(within(pill).getByRole('button', { name: 'Zoom in' }));
      expect(within(pill).getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');
      fireEvent.click(within(pill).getByRole('button', { name: 'Fit to view' }));
      expect(within(pill).getByRole('button', { name: 'Fit to view' }).textContent).toBe('Fit');

      integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: candidateBoard({ revision: 2 }) }));
      await act(async () => { fireEvent.click(within(pill).getByRole('button', { name: 'Hide' })); });
      expect(integration.act).toHaveBeenLastCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'hide', assetFileId: 'af_2' } });

      integration.cast.mockImplementation(async () => ({ sessionId: 'board', actionId: 'action_1', session: candidateBoard({ revision: 3, look: { id: 'look_1', name: 'Young', castAssetFileId: 'af_2' } }) }));
      await act(async () => { fireEvent.click(within(pill).getByRole('button', { name: 'Cast' })); });
      expect(integration.cast).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', assetFileId: 'af_2' });
    });

    it('compares two kept candidates, steps each side past the other, and casts or hides per side', async () => {
      await openBoard(threeKept());
      fireEvent.click(screen.getByRole('button', { name: 'Compare 3' }));
      const first = screen.getByRole('region', { name: 'First candidate' });
      const second = screen.getByRole('region', { name: 'Second candidate' });
      await within(second).findByAltText('Round 1 · Acme Faces');
      loadRenderedImages();
      expect(within(first).getByRole('img', { name: 'Round 1 · Acme Portrait' })).toBeTruthy();
      expect(within(first).getByText('1 of 3')).toBeTruthy();
      expect(within(second).getByText('2 of 3')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(within(first).getByRole('img').style.transform).toContain('scale(0.75)');
      expect(within(second).getByRole('img').style.transform).toContain('scale(0.75)');

      fireEvent.click(within(second).getByRole('button', { name: 'Next candidate' }));
      loadRenderedImages();
      expect(within(second).getByRole('img', { name: 'Round 1 · Acme Studio' }).style.transform).toContain('scale(0.75)');
      fireEvent.click(within(second).getByRole('button', { name: 'Next candidate' }));
      expect(within(second).getByText('2 of 3')).toBeTruthy();
      fireEvent.click(within(first).getByRole('button', { name: 'Next candidate' }));
      expect(within(first).getByRole('img', { name: 'Round 1 · Acme Studio' })).toBeTruthy();

      integration.cast.mockImplementation(async () => ({ sessionId: 'board', actionId: 'action_1', session: threeKept() }));
      await act(async () => { fireEvent.click(within(second).getByRole('button', { name: 'Cast' })); });
      expect(integration.cast).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', assetFileId: 'af_2' });

      integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: threeKept() }));
      await act(async () => { fireEvent.click(within(first).getByRole('button', { name: 'Hide' })); });
      expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'hide', assetFileId: 'af_3' } });
    });

    it('opens a character sheet large and picks it from the viewer', async () => {
      const board = sheetBoard();
      await openBoard(board);
      fireEvent.click(await screen.findByRole('button', { name: 'Open character sheet from acme portrait' }));
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();
      fireEvent.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');

      integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: { ...board, revision: 2, costumes: [board.costumes[0]!, { ...board.costumes[1]!, pickedAssetFileId: 'sheet_2' }] } }));
      await act(async () => { fireEvent.click(within(viewer).getByRole('button', { name: 'Pick' })); });
      expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'pickSheet', costumeId: 'costume_2', assetFileId: 'sheet_2' } });
      expect(within(viewer).getByText('Picked')).toBeTruthy();
    });
  });
});
