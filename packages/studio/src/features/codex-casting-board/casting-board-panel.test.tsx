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
        { assetFileId: 'af_1', status: 'shortlisted', model: portrait, imageUri: 'renku-casting-board://board/media/1' },
        { assetFileId: 'af_2', status: 'candidate', model: faces, imageUri: 'renku-casting-board://board/media/2' },
      ],
    }],
    action: null,
    lastCompletedAction: null,
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
    expect(screen.getByRole('tab', { name: 'All 4' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Shortlist 1' })).toBeTruthy();
    expect(await screen.findByText('Acme Faces', { selector: 'figcaption' })).toBeTruthy();
  });

  it('enables Cast this Look only with exactly one shortlisted candidate and posts the cast', async () => {
    await openBoard(candidateBoard());
    integration.cast.mockImplementation(async () => {
      const session = candidateBoard({ look: { id: 'look_1', name: 'Young', castAssetFileId: 'af_1' }, action: { actionId: 'action_1', kind: 'cast', status: 'pending' } });
      return { sessionId: 'board', actionId: 'action_1', session };
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cast this Look' })); });
    expect(integration.cast).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', assetFileId: 'af_1' });
    expect(integration.notify.mock.calls[0]![2]).toBe('Look cast · Ana · Young · candidate from round 1 (Acme Portrait)');
  });

  it('keeps Cast this Look disabled with none or several shortlisted', async () => {
    const none = candidateBoard();
    none.rounds[0]!.candidates[0]!.status = 'candidate';
    await openBoard(none);
    expect(screen.getByRole('button', { name: 'Cast this Look' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'More like the shortlist' })).toHaveProperty('disabled', true);
    cleanup();
    const several = candidateBoard();
    several.rounds[0]!.candidates[1]!.status = 'shortlisted';
    await openBoard(several);
    expect(screen.getByRole('button', { name: 'Cast this Look' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Compare 2' })).toHaveProperty('disabled', false);
  });

  it('saves shortlist and hide through the act tool and sends "more like the shortlist" with notes', async () => {
    await openBoard(candidateBoard());
    integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: candidateBoard({ revision: 2 }) }));
    await act(async () => { fireEvent.click((await screen.findAllByRole('button', { name: 'Hide' }))[1]!); });
    expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'hide', assetFileId: 'af_2' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove from shortlist' })); });
    expect(integration.act).toHaveBeenLastCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'restore', assetFileId: 'af_1' } });

    integration.request.mockImplementation(async () => ({ sessionId: 'board', actionId: 'action_2', session: candidateBoard({ revision: 3, action: { actionId: 'action_2', kind: 'moreLikeShortlist', status: 'pending' } }) }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes for the next round' }), { target: { value: 'Leaner face' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More like the shortlist' })); });
    expect(integration.request).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', request: { kind: 'moreLikeShortlist', notes: 'Leaner face' } });
    expect(integration.notify.mock.calls[0]![2]).toBe('More candidates requested · Ana · Young · 1 shortlisted');
  });

  it('picks a sheet per costume and sends the picks', async () => {
    const sheets: CastingSheetBoard = {
      mode: 'sheets', sessionId: 'board', revision: 1, castMember: { id: 'cast_1', name: 'Ana' },
      scenes: [{ id: 'scene_1', heading: 'EXT. HARBOR', productionNumber: '3' }, { id: 'scene_2', heading: 'INT. PALACE' }],
      looks: [{ id: 'look_1', name: 'Young', castImageUri: 'renku-casting-board://board/media/3' }],
      costumes: [{ id: 'costume_1', name: 'Harbor coat', lookId: 'look_1', sceneIds: ['scene_1'], pickedAssetFileId: null }],
      sheets: [{ assetFileId: 'sheet_1', imageUri: 'renku-casting-board://board/media/4' }],
      action: null, lastCompletedAction: null,
    };
    await openBoard(sheets);
    expect(screen.getByText('Scene 3')).toBeTruthy();
    expect(screen.getByText('From: Young · cast')).toBeTruthy();
    integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: { ...sheets, revision: 2, costumes: [{ ...sheets.costumes[0]!, pickedAssetFileId: 'sheet_1' }] } }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pick for Harbor coat' })); });
    expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'pickSheet', costumeId: 'costume_1', assetFileId: 'sheet_1' } });
    expect(screen.getByText('1 of 1 picked')).toBeTruthy();
  });

  describe('zoom', () => {
    let restoreLayout: () => void;
    beforeEach(() => { restoreLayout = stubImageZoomLayout({ width: 800, height: 600 }, { width: 1600, height: 1200 }); });
    afterEach(() => { restoreLayout(); });

    const shortlistOfThree = () => {
      const board = candidateBoard();
      board.rounds[0]!.pending = [];
      board.rounds[0]!.candidates = [
        { assetFileId: 'af_1', status: 'shortlisted', model: portrait, imageUri: 'renku-casting-board://board/media/1' },
        { assetFileId: 'af_2', status: 'shortlisted', model: faces, imageUri: 'renku-casting-board://board/media/2' },
        { assetFileId: 'af_3', status: 'shortlisted', model: studio, imageUri: 'renku-casting-board://board/media/3' },
      ];
      return board;
    };

    it('opens a candidate large to zoom and keeps shortlist, hide and cast in the viewer', async () => {
      await openBoard(candidateBoard());
      await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Open casting candidate from acme faces' })); });
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();
      fireEvent.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');
      fireEvent.click(within(viewer).getByRole('button', { name: 'Fit to view' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('Fit');

      integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: candidateBoard({ revision: 2 }) }));
      await act(async () => { fireEvent.click(within(viewer).getByRole('button', { name: 'Shortlist' })); });
      expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'shortlist', assetFileId: 'af_2' } });
      await act(async () => { fireEvent.click(within(viewer).getByRole('button', { name: 'Hide' })); });
      expect(integration.act).toHaveBeenLastCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'hide', assetFileId: 'af_2' } });

      integration.cast.mockImplementation(async () => ({ sessionId: 'board', actionId: 'action_1', session: candidateBoard({ revision: 3, look: { id: 'look_1', name: 'Young', castAssetFileId: 'af_2' } }) }));
      await act(async () => { fireEvent.click(within(viewer).getByRole('button', { name: 'Cast' })); });
      expect(integration.cast).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', assetFileId: 'af_2' });
    });

    it('compares the favorite with one challenger at a time and keeps the zoom while switching', async () => {
      await openBoard(shortlistOfThree());
      fireEvent.click(screen.getByRole('button', { name: 'Compare 3' }));
      const favorite = screen.getByRole('region', { name: 'Favorite' });
      const challenger = screen.getByRole('region', { name: 'Challenger' });
      await within(challenger).findByAltText('Round 1 · Acme Faces');
      loadRenderedImages();
      expect(within(favorite).getByRole('img', { name: 'Round 1 · Acme Portrait' })).toBeTruthy();
      expect(within(challenger).getByRole('img', { name: 'Round 1 · Acme Faces' })).toBeTruthy();
      expect(within(challenger).getByText('1 / 2')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(within(favorite).getByRole('img').style.transform).toContain('scale(0.75)');
      expect(within(challenger).getByRole('img').style.transform).toContain('scale(0.75)');

      fireEvent.click(within(challenger).getByRole('button', { name: 'Next challenger' }));
      expect(within(challenger).getByText('2 / 2')).toBeTruthy();
      loadRenderedImages();
      expect(within(challenger).getByRole('img', { name: 'Round 1 · Acme Studio' }).style.transform).toContain('scale(0.75)');
      expect(screen.getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');

      fireEvent.click(within(challenger).getByRole('button', { name: 'Make favorite' }));
      expect(within(favorite).getByRole('img', { name: 'Round 1 · Acme Studio' })).toBeTruthy();
      expect(within(challenger).getByRole('img', { name: 'Round 1 · Acme Portrait' })).toBeTruthy();

      integration.cast.mockImplementation(async () => ({ sessionId: 'board', actionId: 'action_1', session: shortlistOfThree() }));
      await act(async () => { fireEvent.click(within(challenger).getByRole('button', { name: 'Cast' })); });
      expect(integration.cast).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', assetFileId: 'af_1' });

      integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: shortlistOfThree() }));
      await act(async () => { fireEvent.click(within(challenger).getByRole('button', { name: 'Remove from shortlist' })); });
      expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'restore', assetFileId: 'af_1' } });
    });

    it('folds the shortlist strip away and brings a thumbnail in as the challenger', async () => {
      await openBoard(shortlistOfThree());
      fireEvent.click(screen.getByRole('button', { name: 'Compare 3' }));
      const strip = screen.getByRole('navigation', { name: 'Shortlist' });
      fireEvent.click(within(strip).getByRole('button', { name: 'Compare round 1 · Acme Studio' }));
      expect(within(screen.getByRole('region', { name: 'Challenger' })).getByText('2 / 2')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /^Shortlist 3/ }));
      expect(screen.queryByRole('navigation', { name: 'Shortlist' })).toBeNull();
    });

    it('opens a character sheet large from its corner button and picks it from the viewer', async () => {
      const sheets: CastingSheetBoard = {
        mode: 'sheets', sessionId: 'board', revision: 1, castMember: { id: 'cast_1', name: 'Ana' },
        scenes: [{ id: 'scene_1', heading: 'EXT. HARBOR', productionNumber: '3' }],
        looks: [{ id: 'look_1', name: 'Young', castImageUri: null }],
        costumes: [{ id: 'costume_1', name: 'Harbor coat', lookId: 'look_1', sceneIds: ['scene_1'], pickedAssetFileId: null }],
        sheets: [{ assetFileId: 'sheet_1', imageUri: 'renku-casting-board://board/media/4' }],
        action: null, lastCompletedAction: null,
      };
      await openBoard(sheets);
      fireEvent.click(await screen.findByRole('button', { name: 'View sheet large' }));
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();
      fireEvent.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');

      integration.act.mockImplementation(async () => ({ sessionId: 'board', actionId: null, session: { ...sheets, revision: 2, costumes: [{ ...sheets.costumes[0]!, pickedAssetFileId: 'sheet_1' }] } }));
      await act(async () => { fireEvent.click(within(viewer).getByRole('button', { name: 'Pick' })); });
      expect(integration.act).toHaveBeenCalledWith(integration.bridge, { sessionId: 'board', action: { kind: 'pickSheet', costumeId: 'costume_1', assetFileId: 'sheet_1' } });
      expect(within(viewer).getByText('Picked')).toBeTruthy();
    });
  });
});
