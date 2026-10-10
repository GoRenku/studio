// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionSession } from '@gorenku/studio-codex/dialogue-direction';
import { dialogueDirectionTakeFixture, elevenV4SessionFixture } from '../testing/dialogue-direction-session-fixture';
import { useDialogueDirectionSession } from './use-dialogue-direction-session';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn() }, extensions: {} },
  read: vi.fn(), select: vi.fn(),
}));

vi.mock('@/services/codex-dialogue-direction', () => ({
  createDialogueDirectionApp: () => integration.bridge,
  connectDialogueDirectionApp: async () => {},
  readDialogueDirectionSession: integration.read,
  selectDialogueDirectionTake: integration.select,
  discardDialogueDirectionTake: vi.fn(),
  generateDialogueDirectionTake: vi.fn(),
  notifyDialogueDirectionGenerate: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function openSession(session: DialogueDirectionSession) {
  integration.read.mockResolvedValue(session);
  const hook = renderHook(() => useDialogueDirectionSession('Direction'));
  await act(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session } });
  });
  return hook;
}

async function poll() {
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
}

describe('dialogue direction session refresh', () => {
  it('refreshes idle Takes and selections even when the session revision is unchanged', async () => {
    const session = elevenV4SessionFixture();
    const { result } = await openSession(session);
    expect(integration.read).toHaveBeenCalledOnce();
    const changed = { ...session, takes: [dialogueDirectionTakeFixture('external', 5, 5, { selected: true })] };
    integration.read.mockResolvedValue(changed);
    await poll();
    expect(result.current.session?.takes).toEqual(changed.takes);
    expect(result.current.autoPlayTakeId).toBeUndefined();
  });

  it('pauses reads while hidden, refreshes on visibility and stops on unmount', async () => {
    const { unmount } = await openSession(elevenV4SessionFixture());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await poll();
    expect(integration.read).toHaveBeenCalledOnce();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(integration.read).toHaveBeenCalledTimes(2);
    unmount();
    await poll();
    expect(integration.read).toHaveBeenCalledTimes(2);
  });

  it('keeps one read in flight and ignores a poll superseded by a Take mutation', async () => {
    const session = elevenV4SessionFixture();
    const { result } = await openSession(session);
    let finishRead!: (next: DialogueDirectionSession) => void;
    integration.read.mockReturnValue(new Promise<DialogueDirectionSession>((resolve) => { finishRead = resolve; }));
    await poll();
    await poll();
    expect(integration.read).toHaveBeenCalledTimes(2);
    const selected = { ...session, revision: 2, takes: [dialogueDirectionTakeFixture('selected', 5, 5, { selected: true })] };
    integration.select.mockResolvedValue(selected);
    await act(async () => { await result.current.selectTake('selected', true); });
    await act(async () => { finishRead({ ...session, revision: 2 }); });
    expect(result.current.session).toBe(selected);
    integration.read.mockResolvedValue(selected);
    await poll();
    expect(integration.read).toHaveBeenCalledTimes(3);
  });
});

describe('dialogue direction completion', () => {
  it('uses the reported Take after it appeared in an earlier poll, despite another newer import', async () => {
    const running = elevenV4SessionFixture({ action: { actionId: 'action', turnRange: { start: 5, end: 5 }, status: 'running' } });
    const { result } = await openSession(running);
    const imported = { ...running, takes: [
      dialogueDirectionTakeFixture('reported', 5, 5),
      dialogueDirectionTakeFixture('unrelated', 5, 5, { createdAt: '2026-10-09T11:00:00.000Z' }),
    ] };
    integration.read.mockResolvedValue(imported);
    await poll();
    expect(result.current.autoPlayTakeId).toBeUndefined();
    const completed = { ...imported, revision: 2, action: null, lastCompletedAction: { actionId: 'action', takeId: 'reported' } };
    integration.read.mockResolvedValue(completed);
    await poll();
    expect(result.current.autoPlayTakeId).toBe('reported');
    integration.read.mockResolvedValue({ ...completed });
    await poll();
    expect(result.current.autoPlayTakeId).toBe('reported');
    integration.read.mockResolvedValue(running);
    await poll();
    expect(result.current.session?.lastCompletedAction).toEqual(completed.lastCompletedAction);
  });

  it('does not autoplay an existing completion on opening or when switching sessions', async () => {
    const completed = elevenV4SessionFixture({ lastCompletedAction: { actionId: 'old-action', takeId: 'old-take' } });
    const { result } = await openSession(completed);
    await poll();
    expect(result.current.autoPlayTakeId).toBeUndefined();
    const next = { ...completed, revision: 2, lastCompletedAction: { actionId: 'new-action', takeId: 'new-take' } };
    integration.read.mockResolvedValue(next);
    await poll();
    expect(result.current.autoPlayTakeId).toBe('new-take');
    integration.read.mockResolvedValue({ ...next, sessionId: 'another-session' });
    await act(async () => {
      integration.bridge.app.ontoolresult!({ content: [], structuredContent: { session: { ...next, sessionId: 'another-session' } } });
    });
    expect(result.current.autoPlayTakeId).toBeUndefined();
  });

  it('does not autoplay imports when the action fails', async () => {
    const running = elevenV4SessionFixture({ action: { actionId: 'action', turnRange: { start: 5, end: 5 }, status: 'running' } });
    const { result } = await openSession(running);
    integration.read.mockResolvedValue({ ...running, revision: 2, action: { ...running.action!, status: 'failed', message: 'Provider failed.' }, takes: [dialogueDirectionTakeFixture('external', 5, 5)] });
    await poll();
    expect(result.current.autoPlayTakeId).toBeUndefined();
    expect(result.current.actionActive).toBe(false);
  });
});
