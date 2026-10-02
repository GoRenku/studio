// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectCodexApp, createCodexApp } from './codex-app';

const integration = vi.hoisted(() => ({
  app: { connect: vi.fn(), getHostContext: vi.fn(), addEventListener: vi.fn(), requestDisplayMode: vi.fn() },
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
  integration.app.getHostContext.mockReturnValue({ displayMode: 'inline', availableDisplayModes: ['inline'] });
  integration.extensions.message = { send: vi.fn() };
});

describe('Codex review display handshake', () => {
  it('advertises both supported modes and enables SDK size notifications', () => {
    createCodexApp('Review');
    expect(integration.App).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Review' }),
      { availableDisplayModes: ['inline', 'fullscreen'] },
      { autoResize: true }
    );
  });

  it.each(['inline', 'fullscreen'])('accepts the host-selected %s mode without requesting a different mode', async (mode) => {
    integration.app.getHostContext.mockReturnValue({ displayMode: mode, availableDisplayModes: [mode] });
    await expect(connectCodexApp(createCodexApp('Review'), true)).resolves.toBe(mode);
    expect(integration.app.requestDisplayMode).not.toHaveBeenCalled();
  });

  it.each([undefined, 'pip'])('rejects an unsupported or missing mode (%s)', async (mode) => {
    integration.app.getHostContext.mockReturnValue({ displayMode: mode, availableDisplayModes: ['inline', 'fullscreen'] });
    await expect(connectCodexApp(createCodexApp('Review'), true)).rejects.toMatchObject({ code: 'CODEX_REVIEW_UNSUPPORTED' });
    expect(integration.app.requestDisplayMode).not.toHaveBeenCalled();
  });

  it('requires conversation messaging in inline mode before enabling review interaction', async () => {
    integration.extensions.message = undefined;
    await expect(connectCodexApp(createCodexApp('Review'), true)).rejects.toMatchObject({ code: 'CODEX_REVIEW_UNSUPPORTED' });
  });

  it('propagates a failed connection instead of guessing a display mode', async () => {
    integration.app.connect.mockRejectedValue(new Error('Host connection failed.'));
    await expect(connectCodexApp(createCodexApp('Review'), true)).rejects.toThrow('Host connection failed.');
    expect(integration.app.getHostContext).not.toHaveBeenCalled();
  });
});
