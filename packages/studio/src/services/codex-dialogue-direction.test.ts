// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionGenerateReceipt } from '@gorenku/studio-codex/dialogue-direction';
import { elevenV4SessionFixture } from '@/features/codex-dialogue-direction/testing/dialogue-direction-session-fixture';
import { connectDialogueDirectionApp, createDialogueDirectionApp, notifyDialogueDirectionGenerate, selectDialogueDirectionTake } from './codex-dialogue-direction';

const integration = vi.hoisted(() => ({
  app: { connect: vi.fn(), getHostContext: vi.fn(), addEventListener: vi.fn(), callServerTool: vi.fn() },
  extensions: { message: undefined as { send: ReturnType<typeof vi.fn> } | undefined },
  App: vi.fn(),
}));

vi.mock('@modelcontextprotocol/ext-apps', () => ({
  App: integration.App,
  applyDocumentTheme: vi.fn(),
  applyHostStyleVariables: vi.fn(),
}));
vi.mock('@openai/mcp-extensions/app', () => ({
  OpenAIExtensions: vi.fn(function () { return integration.extensions; }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  integration.App.mockImplementation(function () { return integration.app; });
  integration.app.connect.mockResolvedValue(undefined);
  integration.app.getHostContext.mockReturnValue({ displayMode: 'fullscreen' });
  integration.extensions.message = { send: vi.fn().mockResolvedValue({}) };
});

describe('Codex dialogue direction bridge', () => {
  it('advertises fullscreen as the only display mode', () => {
    createDialogueDirectionApp('Direction');
    expect(integration.App).toHaveBeenCalledWith(expect.objectContaining({ name: 'Direction' }), { availableDisplayModes: ['fullscreen'] }, { autoResize: true });
  });

  it.each(['inline', 'pip', undefined])('refuses a %s host display mode', async (displayMode) => {
    integration.app.getHostContext.mockReturnValue({ displayMode });
    await expect(connectDialogueDirectionApp(createDialogueDirectionApp('Direction'))).rejects.toMatchObject({ code: 'CODEX_DIALOGUE_DIRECTION_UNSUPPORTED' });
  });

  it('requires conversation messaging', async () => {
    integration.extensions.message = undefined;
    await expect(connectDialogueDirectionApp(createDialogueDirectionApp('Direction'))).rejects.toMatchObject({ code: 'CODEX_DIALOGUE_DIRECTION_UNSUPPORTED' });
  });

  it.each([
    [{ start: 7, end: 7 }, 'Line 7'],
    [{ start: 7, end: 9 }, 'Lines 7–9'],
  ])('posts the exact Generate message for %o', async (turnRange, label) => {
    const receipt: DialogueDirectionGenerateReceipt = { sessionId: 'session', actionId: 'action', turnRange, session: elevenV4SessionFixture() };
    await notifyDialogueDirectionGenerate(createDialogueDirectionApp('Direction'), receipt);
    expect(integration.extensions.message!.send).toHaveBeenCalledWith({
      role: 'user',
      content: [{ type: 'text', text: `Generate dialogue Take · Shot plan 02-01 · ${label}. Session session, action action. Consume it with dialogue.direction.consume once.` }],
      _meta: { 'openai/message': { target: 'active', send: true } },
    });
  });

  it('reports structured tool failures with their code', async () => {
    integration.app.callServerTool.mockResolvedValue({ isError: true, content: [{ type: 'text', text: '[CODEX_DIALOGUE_DIRECTION_NOT_FOUND] Missing.' }], structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_NOT_FOUND', message: 'Missing.' } } });
    await expect(selectDialogueDirectionTake(createDialogueDirectionApp('Direction'), { sessionId: 'session', takeId: 'take', selected: true }))
      .rejects.toMatchObject({ code: 'CODEX_DIALOGUE_DIRECTION_NOT_FOUND', message: 'Missing.' });
    expect(integration.app.callServerTool).toHaveBeenCalledWith({ name: 'dialogue.direction.take.select', arguments: { sessionId: 'session', takeId: 'take', selected: true } });
  });
});
