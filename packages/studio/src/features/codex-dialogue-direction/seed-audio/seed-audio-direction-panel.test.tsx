// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionSession, SeedAudioDirectionDraft } from '@gorenku/studio-codex/dialogue-direction';
import { seedAudioSessionFixture } from '../testing/dialogue-direction-session-fixture';
import { directionEditorView, installDirectionPanelEnvironment, replaceDirectionEditorText } from '../testing/dialogue-direction-test-environment';
import { SeedAudioDirectionPanel } from './seed-audio-direction-panel';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  session: undefined as unknown,
  connect: vi.fn(), generate: vi.fn(), notify: vi.fn(), read: vi.fn(),
}));

vi.mock('@/services/codex-dialogue-direction', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/codex-dialogue-direction')>()),
  createDialogueDirectionApp: () => integration.bridge,
  connectDialogueDirectionApp: integration.connect,
  generateDialogueDirectionTake: integration.generate,
  notifyDialogueDirectionGenerate: integration.notify,
  readDialogueDirectionSession: integration.read,
}));
vi.mock('@/services/codex-app', () => ({ readCodexAppMediaBlob: () => new Promise(() => {}) }));

beforeEach(() => {
  vi.clearAllMocks();
  installDirectionPanelEnvironment();
  integration.read.mockImplementation(async () => integration.session);
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session: integration.session } });
  });
  integration.generate.mockImplementation(async (_bridge, { draft }: { draft: SeedAudioDirectionDraft }) => {
    const session = integration.session as DialogueDirectionSession;
    return { sessionId: session.sessionId, actionId: 'action', turnRange: draft.turnRange, session: { ...session, revision: 2, action: { actionId: 'action', turnRange: draft.turnRange, status: 'pending' } } };
  });
  integration.notify.mockResolvedValue(undefined);
});

afterEach(cleanup);

async function openPanel(session: DialogueDirectionSession) {
  integration.session = session;
  render(<SeedAudioDirectionPanel />);
  await screen.findByRole('button', { name: 'Select all' });
}

function railRow(number: number): HTMLElement {
  const rail = screen.getByRole('navigation', { name: 'Dialogue lines' });
  return within(rail).getAllByRole('button').find((button) => button.hasAttribute('aria-pressed') && within(button).queryByText(String(number)))!;
}

function prompt(): string {
  return directionEditorView('Performance prompt').state.doc.toString();
}

describe('Seed Audio dialogue direction panel', () => {
  it('inserts @AudioN from a speaker avatar when the route uses audio tags', async () => {
    await openPanel(seedAudioSessionFixture({}, { prompts: [{ turnRange: { start: 7, end: 8 }, prompt: 'Scene.' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert @Audio2' }));
    expect(prompt()).toBe('@Audio2 Scene.');
  });

  it('offers no avatar insertion when the route has no prompt mentions', async () => {
    await openPanel(seedAudioSessionFixture({}, { promptMentions: 'none' }));
    expect(screen.queryByRole('button', { name: /Insert @Audio/ })).toBeNull();
  });

  it('replaces the voices with a notice and disables Generate over three speakers', async () => {
    await openPanel(seedAudioSessionFixture());
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('Seed Audio takes up to three voices. Select fewer lines.')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate' })).toHaveProperty('disabled', true);
  });

  it('warns past 2,048 prompt characters without blocking Generate', async () => {
    await openPanel(seedAudioSessionFixture());
    replaceDirectionEditorText('Performance prompt', 'x'.repeat(2049));
    const counter = screen.getByText('2,049 / 2,048');
    expect(counter.hasAttribute('data-over-limit')).toBe(true);
    expect(screen.getByRole('button', { name: 'Generate' })).toHaveProperty('disabled', false);
  });

  it('keeps prompt drafts per exact range and carries the current text into a new range', async () => {
    await openPanel(seedAudioSessionFixture());
    const agentPrompt = prompt();
    replaceDirectionEditorText('Performance prompt', 'Edited for seven to eight.');
    fireEvent.click(railRow(4));
    expect(prompt()).toBe('Edited for seven to eight.');
    replaceDirectionEditorText('Performance prompt', 'Line four only.');
    fireEvent.click(railRow(7));
    fireEvent.click(railRow(8), { shiftKey: true });
    expect(prompt()).toBe('Edited for seven to eight.');
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(prompt()).toBe(agentPrompt);
    fireEvent.click(railRow(4));
    expect(prompt()).toBe('Line four only.');
  });

  it('generates with voice references in order of first appearance', async () => {
    await openPanel(seedAudioSessionFixture());
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Voice for Constantine' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Weary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(integration.notify).toHaveBeenCalledOnce());
    expect(integration.generate.mock.calls[0]![1]).toEqual({
      sessionId: 'session',
      draft: {
        panel: 'seed-audio',
        turnRange: { start: 7, end: 8 },
        prompt: '@Audio1 is Urban, @Audio2 is Constantine. "Then the empire is suffocating."',
        voiceReferences: [
          { position: 1, castMemberId: 'cast-urban', castVoiceId: 'cast-urban-baritone' },
          { position: 2, castMemberId: 'cast-constantine', castVoiceId: 'cast-constantine-weary' },
        ],
      },
    });
    expect(screen.getByRole('listitem', { name: 'Generating Take 1' })).toBeTruthy();
  });

  it('enables Generate again after the agent reports a failure', async () => {
    await openPanel(seedAudioSessionFixture({ action: { actionId: 'action', turnRange: { start: 7, end: 8 }, status: 'failed', message: 'Seed Audio timed out.' } }));
    expect(screen.getByRole('alert').textContent).toBe('Seed Audio timed out.');
    expect(screen.getByRole('button', { name: 'Generate' })).toHaveProperty('disabled', false);
  });
});
