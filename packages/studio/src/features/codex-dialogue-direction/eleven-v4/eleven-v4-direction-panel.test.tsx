// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionSession, ElevenV4DirectionDraft } from '@gorenku/studio-codex/dialogue-direction';
import { dialogueDirectionTakeFixture, elevenV4SessionFixture } from '../testing/dialogue-direction-session-fixture';
import { directionEditorView, installDirectionPanelEnvironment, replaceDirectionEditorText } from '../testing/dialogue-direction-test-environment';
import { ElevenV4DirectionPanel } from './eleven-v4-direction-panel';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  session: undefined as unknown,
  connect: vi.fn(), readMedia: vi.fn(), generate: vi.fn(), notify: vi.fn(), select: vi.fn(), discard: vi.fn(), read: vi.fn(),
}));

vi.mock('@/services/codex-dialogue-direction', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/codex-dialogue-direction')>()),
  createDialogueDirectionApp: () => integration.bridge,
  connectDialogueDirectionApp: integration.connect,
  generateDialogueDirectionTake: integration.generate,
  notifyDialogueDirectionGenerate: integration.notify,
  selectDialogueDirectionTake: integration.select,
  discardDialogueDirectionTake: integration.discard,
  readDialogueDirectionSession: integration.read,
}));
vi.mock('@/services/codex-app', () => ({ readCodexAppMediaBlob: integration.readMedia }));

beforeEach(() => {
  vi.clearAllMocks();
  installDirectionPanelEnvironment();
  integration.readMedia.mockReturnValue(new Promise(() => {}));
  integration.read.mockImplementation(async () => integration.session);
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session: integration.session } });
  });
  integration.generate.mockImplementation(async (_bridge, { draft }: { draft: ElevenV4DirectionDraft }) => {
    const session = integration.session as DialogueDirectionSession;
    return { sessionId: session.sessionId, actionId: 'action', turnRange: draft.turnRange, session: { ...session, revision: 2, action: { actionId: 'action', turnRange: draft.turnRange, status: 'pending' } } };
  });
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function openPanel(session: DialogueDirectionSession) {
  integration.session = session;
  render(<ElevenV4DirectionPanel />);
  await screen.findByRole('button', { name: 'Select all' });
}

function railRow(number: number): HTMLElement {
  const rail = screen.getByRole('navigation', { name: 'Dialogue lines' });
  return within(rail).getAllByRole('button').find((button) => button.hasAttribute('aria-pressed') && within(button).queryByText(String(number)))!;
}

function lastDraft(): ElevenV4DirectionDraft {
  return integration.generate.mock.calls.at(-1)![1].draft;
}

describe('Eleven v4 dialogue direction panel', () => {
  it('switches between the single-line and dialogue desks and keeps per-line acting scripts', async () => {
    await openPanel(elevenV4SessionFixture());
    expect(screen.getByText('Bronze. Powder. Charcoal.', { selector: 'p' })).toBeTruthy();
    replaceDirectionEditorText('Acting script for line 5', '[edited] Bronze.');

    fireEvent.click(railRow(7), { shiftKey: true });
    expect(screen.getAllByRole('textbox').map((editor) => editor.getAttribute('aria-label'))).toEqual(['Acting script for line 5', 'Acting script for line 6', 'Acting script for line 7']);
    expect(directionEditorView('Acting script for line 5').state.doc.toString()).toBe('[edited] Bronze.');
    replaceDirectionEditorText('Acting script for line 7', '[cold] Suffocating.');

    fireEvent.click(railRow(7));
    expect(directionEditorView('Acting script for line 7').state.doc.toString()).toBe('[cold] Suffocating.');
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(directionEditorView('Acting script for line 7').state.doc.toString()).toBe('[cold, quiet] Then the empire is suffocating.');
  });

  it('inserts suggested tags into the editor that last had focus', async () => {
    await openPanel(elevenV4SessionFixture({}, { selection: { start: 5, end: 7 } }));
    const line6 = directionEditorView('Acting script for line 6');
    fireEvent.focus(line6.contentDOM);
    fireEvent.click(screen.getByRole('button', { name: '[whispers]' }));
    expect(line6.state.doc.toString()).toBe('[whispers] [flat] This is what the empire can breathe.');
    expect(directionEditorView('Acting script for line 5').state.doc.toString()).toBe('[brisk] Bronze. Powder. Charcoal.');
  });

  it('generates a dialogue draft with one voice per speaker, then posts the conversation message', async () => {
    await openPanel(elevenV4SessionFixture({}, { selection: { start: 5, end: 7 } }));
    expect(screen.getAllByRole('combobox').map((select) => select.getAttribute('aria-label'))).toEqual(['Voice for Urban', 'Voice for Loukas']);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Voice for Urban' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Hoarse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(integration.notify).toHaveBeenCalledOnce());
    expect(lastDraft()).toEqual({
      panel: 'eleven-v4',
      turnRange: { start: 5, end: 7 },
      lines: [
        { number: 5, actingScript: '[brisk] Bronze. Powder. Charcoal.' },
        { number: 6, actingScript: '[flat] This is what the empire can breathe.' },
        { number: 7, actingScript: '[cold, quiet] Then the empire is suffocating.' },
      ],
      voices: [{ castMemberId: 'cast-urban', castVoiceId: 'cast-urban-hoarse' }, { castMemberId: 'cast-loukas', castVoiceId: 'cast-loukas-clerk' }],
      voiceSettings: { stability: 0.45, similarity: 0.75 },
    });
    expect(integration.generate.mock.invocationCallOrder[0]).toBeLessThan(integration.notify.mock.invocationCallOrder[0]!);
    expect(screen.getByRole('button', { name: 'Generating…' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('listitem', { name: 'Generating Take 1' })).toBeTruthy();
  });

  it('generates from ⌘/Ctrl+Enter in an editor', async () => {
    await openPanel(elevenV4SessionFixture());
    const editor = directionEditorView('Acting script for line 5');
    fireEvent.keyDown(editor.contentDOM, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(integration.generate).toHaveBeenCalledOnce());
    expect(lastDraft().turnRange).toEqual({ start: 5, end: 5 });
  });

  it('warns past 2,000 dialogue characters without blocking Generate', async () => {
    await openPanel(elevenV4SessionFixture({}, { selection: { start: 5, end: 6 } }));
    expect(screen.queryByText(/\/ 2,000/)?.hasAttribute('data-over-limit')).toBe(false);
    replaceDirectionEditorText('Acting script for line 5', 'x'.repeat(1990));
    const counter = screen.getByText(/\/ 2,000/);
    expect(counter.textContent).toBe('2,033 / 2,000');
    expect(counter.hasAttribute('data-over-limit')).toBe(true);
    expect(screen.getByRole('button', { name: 'Generate' })).toHaveProperty('disabled', false);
  });

  it('loads acting scripts from single-line and dialogue Takes', async () => {
    await openPanel(elevenV4SessionFixture({ takes: [
      dialogueDirectionTakeFixture('single', 5, 5, { actingScripts: { 5: '[from take] Bronze.' } }),
      dialogueDirectionTakeFixture('dialogue', 5, 6, { actingScripts: { 5: '[range] Bronze.', 6: '[range] Breathe.' } }),
    ] }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit from Take 1' }));
    expect(directionEditorView('Acting script for line 5').state.doc.toString()).toBe('[from take] Bronze.');
    fireEvent.click(railRow(6), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit from Take 1' }));
    expect(directionEditorView('Acting script for line 5').state.doc.toString()).toBe('[range] Bronze.');
    expect(directionEditorView('Acting script for line 6').state.doc.toString()).toBe('[range] Breathe.');
  });

  it('disables Select all once every line is selected', async () => {
    await openPanel(elevenV4SessionFixture());
    const selectAll = screen.getByRole('button', { name: 'Select all' });
    expect(selectAll).toHaveProperty('disabled', false);
    fireEvent.click(selectAll);
    expect(selectAll).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('auto-plays the Take attached by the agent report', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const pending = elevenV4SessionFixture({ action: { actionId: 'action', turnRange: { start: 5, end: 5 }, status: 'running' } });
      integration.readMedia.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }));
      vi.stubGlobal('URL', class extends URL { static createObjectURL = () => 'blob:take'; static revokeObjectURL = () => {}; });
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const imported = { ...pending, takes: [dialogueDirectionTakeFixture('attached', 5, 5, { selected: true })] };
      integration.read.mockResolvedValueOnce(imported).mockResolvedValue({ ...imported, revision: 3, action: null, lastCompletedAction: { actionId: 'action', takeId: 'attached' } });
      await openPanel(pending);
      const audio = await waitFor(() => {
        const element = screen.getByRole('listitem', { name: 'Take 1' }).querySelector('audio');
        expect(element).not.toBeNull();
        return element!;
      });
      expect(audio.autoplay).toBe(false);
      expect(play).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(integration.read).toHaveBeenCalledWith(integration.bridge, 'session');
      const take = await screen.findByRole('listitem', { name: 'Take 1' });
      expect(within(take).getByRole('radio').getAttribute('aria-checked')).toBe('true');
      await waitFor(() => expect(take.querySelector('audio')?.autoplay).toBe(true));
      expect(take.querySelector('audio')).toBe(audio);
      expect(play).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(play).toHaveBeenCalledOnce();
      expect(screen.getByRole('button', { name: 'Generate' })).toHaveProperty('disabled', false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the notice hidden while the first notification is being sent', async () => {
    let finishNotification!: () => void;
    integration.notify.mockReturnValueOnce(new Promise<void>((resolve) => { finishNotification = resolve; }));
    await openPanel(elevenV4SessionFixture());
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(integration.notify).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Retry notification' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => { finishNotification(); });
    expect(screen.queryByRole('button', { name: 'Retry notification' })).toBeNull();
  });

  it.each(['select', 'discard'] as const)('keeps notification retry available after a Take %s clears the error', async (operation) => {
    const session = elevenV4SessionFixture({ takes: [dialogueDirectionTakeFixture('existing', 5, 5)] });
    integration.notify.mockRejectedValueOnce(new Error('Could not notify the conversation.'));
    integration[operation].mockResolvedValue({ ...session, revision: 3, action: { actionId: 'action', turnRange: { start: 5, end: 5 }, status: 'pending' }, takes: operation === 'discard' ? [] : session.takes });
    await openPanel(session);
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByText('Could not notify the conversation.');
    if (operation === 'select') {
      fireEvent.click(screen.getByRole('radio', { name: 'Select Take 1' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Take 1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    }
    await waitFor(() => expect(screen.queryByText('Could not notify the conversation.')).toBeNull());
    const retry = screen.getByRole('button', { name: 'Retry notification' });
    await waitFor(() => expect(retry).toHaveProperty('disabled', false));
    expect(screen.getByRole('button', { name: 'Generating…' })).toHaveProperty('disabled', true);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry notification' })).toBeNull());
    expect(integration.generate).toHaveBeenCalledOnce();
    expect(integration.notify).toHaveBeenCalledTimes(2);
    expect(integration.notify.mock.calls[1]![1]).toBe(integration.notify.mock.calls[0]![1]);
  });
});
