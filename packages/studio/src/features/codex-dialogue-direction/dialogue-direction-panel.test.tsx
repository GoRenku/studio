// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionDraft, DialogueDirectionRoute, DialogueDirectionSession } from '@gorenku/studio-codex/dialogue-direction';
import { DialogueDirectionPanel } from './dialogue-direction-panel';
import {
  dialogueDirectionTakeFixture,
  lineScriptsRouteFixture,
  lineScriptsSessionFixture,
  rangePromptRouteFixture,
  rangePromptSessionFixture,
} from './testing/dialogue-direction-session-fixture';
import { directionEditorView, installDirectionPanelEnvironment, replaceDirectionEditorText } from './testing/dialogue-direction-test-environment';

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
  integration.generate.mockImplementation(async (_bridge, { draft }: { draft: DialogueDirectionDraft }) => {
    const session = integration.session as DialogueDirectionSession;
    return { sessionId: session.sessionId, actionId: 'action', turnRange: draft.turnRange, session: { ...session, revision: 2, action: { actionId: 'action', turnRange: draft.turnRange, status: 'pending' } } };
  });
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function openPanel(session: DialogueDirectionSession) {
  integration.session = session;
  render(<DialogueDirectionPanel />);
  await screen.findByRole('navigation', { name: 'Dialogue lines' });
}

function railRow(number: number): HTMLElement {
  const rail = screen.getByRole('navigation', { name: 'Dialogue lines' });
  return within(rail).getAllByRole('button').find((button) => button.hasAttribute('aria-pressed') && within(button).queryByText(String(number)))!;
}

function lastDraft(): DialogueDirectionDraft {
  return integration.generate.mock.calls.at(-1)![1].draft;
}

describe('dialogue direction panel: Line Scripts', () => {
  it('shows the route label, switches between single-line and multi-line editors and keeps per-line scripts', async () => {
    await openPanel(lineScriptsSessionFixture());
    expect(screen.getByText('Acme Voice One · Acme Audio')).toBeTruthy();
    expect(screen.getByText('Bronze. Powder. Charcoal.', { selector: 'p' })).toBeTruthy();
    replaceDirectionEditorText('Direction for line 5', '[edited] Bronze.');

    fireEvent.click(railRow(7), { shiftKey: true });
    expect(screen.getAllByRole('textbox').map((editor) => editor.getAttribute('aria-label'))).toEqual(['Direction for line 5', 'Direction for line 6', 'Direction for line 7']);
    expect(directionEditorView('Direction for line 5').state.doc.toString()).toBe('[edited] Bronze.');
    replaceDirectionEditorText('Direction for line 7', '[cold] Suffocating.');

    fireEvent.click(railRow(7));
    expect(directionEditorView('Direction for line 7').state.doc.toString()).toBe('[cold] Suffocating.');
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(directionEditorView('Direction for line 7').state.doc.toString()).toBe('[cold, quiet] Then the empire is suffocating.');
  });

  it('inserts suggested tags verbatim into the editor that last had focus', async () => {
    await openPanel(lineScriptsSessionFixture({}, { selection: { start: 5, end: 7 }, suggestedTags: ['(sighs)', '[whispers]'] }));
    const line6 = directionEditorView('Direction for line 6');
    fireEvent.focus(line6.contentDOM);
    fireEvent.click(screen.getByRole('button', { name: '(sighs)' }));
    expect(line6.state.doc.toString()).toBe('(sighs) [flat] This is what the empire can breathe.');
    expect(directionEditorView('Direction for line 5').state.doc.toString()).toBe('[brisk] Bronze. Powder. Charcoal.');
  });

  it('generates a multi-line draft with the Line-Range values and posts the approval from route labels', async () => {
    await openPanel(lineScriptsSessionFixture({}, { selection: { start: 5, end: 7 } }));
    expect(screen.getAllByRole('combobox').map((select) => select.getAttribute('aria-label'))).toEqual(['Voice for Urban', 'Voice for Loukas']);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Voice for Urban' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Hoarse' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Warmth' }), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(integration.notify).toHaveBeenCalledOnce());
    expect(lastDraft()).toEqual({
      turnRange: { start: 5, end: 7 },
      scripts: [
        { turnRange: { start: 5, end: 5 }, text: '[brisk] Bronze. Powder. Charcoal.' },
        { turnRange: { start: 6, end: 6 }, text: '[flat] This is what the empire can breathe.' },
        { turnRange: { start: 7, end: 7 }, text: '[cold, quiet] Then the empire is suffocating.' },
      ],
      voices: [{ castMemberId: 'cast-urban', castVoiceId: 'cast-urban-hoarse' }, { castMemberId: 'cast-loukas', castVoiceId: 'cast-loukas-clerk' }],
      values: { '/tuning/warmth': 0.46 },
    });
    expect(integration.notify.mock.calls[0]![2]).toBe('I approve sending this direction and the chosen voices to Acme Audio and running one paid Acme Voice One generation with my saved Acme Audio key.');
    expect(screen.getByText('Generate sends this direction and the chosen voices to Acme Audio and runs one paid Acme Voice One generation with your saved Acme Audio key.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generating…' })).toHaveProperty('disabled', true);
  });

  it('switches the active operation\'s controls and character counter with the selection', async () => {
    await openPanel(lineScriptsSessionFixture());
    expect(screen.getByText('0.45')).toBeTruthy();
    expect(screen.queryByText(/\/ 2,000/)).toBeNull();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Warmth' }), { key: 'ArrowLeft' });
    expect(screen.getByText('0.44')).toBeTruthy();
    fireEvent.click(railRow(6), { shiftKey: true });
    expect(screen.getByText('0.45')).toBeTruthy();
    expect(screen.getByText(/\/ 2,000/)).toBeTruthy();
    fireEvent.click(railRow(5));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(integration.generate).toHaveBeenCalledOnce());
    expect(lastDraft().values).toEqual({ '/voice/warmth': 0.44 });
  });

  it('edits from a Take through its Direction Scripts', async () => {
    await openPanel(lineScriptsSessionFixture({ takes: [dialogueDirectionTakeFixture('take', 5, 5, { scripts: [{ turnRange: { start: 5, end: 5 }, text: '[earlier] Bronze.' }] })] }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit from Take 1' }));
    expect(directionEditorView('Direction for line 5').state.doc.toString()).toBe('[earlier] Bronze.');
  });

  it('highlights the route\'s emphasis syntax, and nothing when the route has none', async () => {
    await openPanel(lineScriptsSessionFixture());
    expect(document.querySelector('.cm-direction-tag')?.textContent).toBe('[brisk]');
    cleanup();
    await openPanel(lineScriptsSessionFixture({ route: { ...lineScriptsRouteFixture(), emphasis: null } }));
    expect(document.querySelector('.cm-direction-tag')).toBeNull();
  });

  it('keeps a single-line-only route to one line and offers no Select all', async () => {
    const base = lineScriptsRouteFixture();
    const route: DialogueDirectionRoute = { ...base, emphasis: null, maxVoices: 1, operations: { singleLine: base.operations.singleLine, lineRange: null } };
    await openPanel(lineScriptsSessionFixture({ route }));
    expect(screen.queryByRole('button', { name: 'Select all' })).toBeNull();
    fireEvent.click(railRow(7), { shiftKey: true });
    expect(screen.getAllByRole('textbox').map((editor) => editor.getAttribute('aria-label'))).toEqual(['Direction for line 7']);
  });
});

describe('dialogue direction panel: Range Prompt', () => {
  it('numbers Voice References and inserts exact Voice Mentions from the avatars', async () => {
    await openPanel(rangePromptSessionFixture());
    expect(screen.getByText('Acme Ensemble · Acme Audio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Insert <v2>' }));
    expect(directionEditorView('Direction for the selected lines').state.doc.toString()).toBe('<v2> <v1> is Urban, <v2> is Constantine. "Then the empire is suffocating."');
  });

  it('colours quoted spans and Voice Mentions', async () => {
    await openPanel(rangePromptSessionFixture());
    expect(document.querySelector('.cm-direction-quote')?.textContent).toBe('"Then the empire is suffocating."');
    expect([...document.querySelectorAll('.cm-direction-mention')].map((mention) => mention.textContent)).toEqual(['<v1>', '<v2>']);
  });

  it('generates one script for the selected range with voices in order of first appearance', async () => {
    await openPanel(rangePromptSessionFixture());
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(integration.notify).toHaveBeenCalledOnce());
    expect(lastDraft()).toEqual({
      turnRange: { start: 7, end: 8 },
      scripts: [{ turnRange: { start: 7, end: 8 }, text: '<v1> is Urban, <v2> is Constantine. "Then the empire is suffocating."' }],
      voices: [{ castMemberId: 'cast-urban', castVoiceId: 'cast-urban-baritone' }, { castMemberId: 'cast-constantine', castVoiceId: 'cast-constantine-tenor' }],
      values: {},
    });
    expect(integration.notify.mock.calls[0]![2]).toBe('I approve sending this direction and the chosen voices to Acme Audio and running one paid Acme Ensemble generation with my saved Acme Audio key.');
  });

  it('shows the voice-limit notice and disables Generate past the route\'s voices', async () => {
    await openPanel(rangePromptSessionFixture({}, { selection: { start: 4, end: 9 } }));
    expect(screen.getByRole('status').textContent).toBe('Acme Ensemble takes up to 3 voices. Select fewer lines.');
    expect(screen.getByRole('button', { name: 'Generate' })).toHaveProperty('disabled', true);
  });

  it('renders Speaker Voices without badges or mentions and edits from a Take', async () => {
    const route: DialogueDirectionRoute = { ...rangePromptRouteFixture(), voiceBinding: { kind: 'speaker-voices' }, emphasis: null };
    await openPanel(rangePromptSessionFixture({ route, takes: [dialogueDirectionTakeFixture('take', 7, 8, { scripts: [{ turnRange: { start: 7, end: 8 }, text: 'Earlier prompt.' }] })] }));
    expect(screen.queryByRole('button', { name: /^Insert / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit from Take 1' }));
    expect(directionEditorView('Direction for the selected lines').state.doc.toString()).toBe('Earlier prompt.');
  });
});
