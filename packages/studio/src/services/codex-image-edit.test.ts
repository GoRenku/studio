// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imageEditSessionFixture, imageEditTargetChooserFixture } from '@/features/codex-image-edit/testing/image-edit-session-fixture';
import {
  connectImageEditApp,
  connectImageEditTargetChooserApp,
  createImageEditApp,
  createImageEditTargetChooserApp,
  notifyImageEditGenerate,
  notifyImageEditTargetChoice,
} from './codex-image-edit';

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
  integration.extensions.message = { send: vi.fn().mockResolvedValue({}) };
});

function sentText(): string {
  return integration.extensions.message!.send.mock.calls[0]![0].content[0].text;
}

describe('Codex image edit bridge', () => {
  it('opens the edit panel fullscreen only and the chooser inline only', async () => {
    createImageEditApp('Edit');
    expect(integration.App).toHaveBeenLastCalledWith(expect.anything(), { availableDisplayModes: ['fullscreen'] }, { autoResize: true });
    createImageEditTargetChooserApp('Choose');
    expect(integration.App).toHaveBeenLastCalledWith(expect.anything(), { availableDisplayModes: ['inline'] }, { autoResize: true });

    integration.app.getHostContext.mockReturnValue({ displayMode: 'inline' });
    await expect(connectImageEditApp(createImageEditApp('Edit'))).rejects.toMatchObject({ code: 'CODEX_IMAGE_EDIT_UNSUPPORTED' });
    await expect(connectImageEditTargetChooserApp(createImageEditTargetChooserApp('Choose'))).resolves.toBeUndefined();
  });

  it('posts the exact Generate and choice messages the agent consumes', async () => {
    const bridge = createImageEditApp('Edit');
    await notifyImageEditGenerate(bridge, { sessionId: 'session', actionId: 'action', session: imageEditSessionFixture() }, 'Constantine XI Palaiologos · Profile image Take 3');
    expect(sentText()).toBe('Generate image edit · Constantine XI Palaiologos · Profile image Take 3. Session session, action action. Consume it with image.edit.consume once.');
    expect(integration.extensions.message!.send.mock.calls[0]![0]._meta).toEqual({ 'openai/message': { target: 'active', send: true } });

    integration.extensions.message!.send.mockClear();
    await notifyImageEditTargetChoice(bridge, imageEditTargetChooserFixture({ choice: { status: 'chosen', assetFileId: 'profile-3' } }), 'Constantine XI Palaiologos · Profile image · Take 3');
    expect(sentText()).toBe('Edit image chosen · Constantine XI Palaiologos · Profile image · Take 3. Chooser chooser. Consume it with image.edit.target.consume once.');

    integration.extensions.message!.send.mockClear();
    await notifyImageEditTargetChoice(bridge, imageEditTargetChooserFixture({ choice: { status: 'canceled' } }), null);
    expect(sentText()).toBe('Image choice canceled. Chooser chooser. Consume it with image.edit.target.consume once.');
  });
});
