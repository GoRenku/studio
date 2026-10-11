import type { McpUiDisplayMode } from '@modelcontextprotocol/ext-apps';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { connectCodexAppHost, createCodexApp, type CodexApp } from '@/services/codex-app';

/** Names and error codes of one Codex panel family, used in every bridge failure it reports. */
export interface CodexPanelFamily {
  label: string;
  invalidCode: string;
  unsupportedCode: string;
}

interface CodexPanelToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}

export function createCodexPanelApp(name: string, displayMode: McpUiDisplayMode): CodexApp {
  return createCodexApp(name, [displayMode]);
}

/** Connects a panel that only works in one display mode and posts into its conversation. */
export async function connectCodexPanelApp(bridge: CodexApp, displayMode: McpUiDisplayMode, family: CodexPanelFamily): Promise<void> {
  const context = await connectCodexAppHost(bridge);
  if (context?.displayMode !== displayMode) throw unsupported(family, `This host did not open the ${family.label} panel ${displayMode}.`);
  if (!bridge.extensions.message) throw unsupported(family, `This host cannot send ${family.label} to its conversation.`);
}

export async function callCodexPanelTool(bridge: CodexApp, name: string, input: Record<string, unknown>, family: CodexPanelFamily): Promise<Record<string, unknown>> {
  const result = await bridge.app.callServerTool({ name, arguments: input }) as CodexPanelToolResult;
  if (result.isError) throw toolFailure(result, family);
  if (!result.structuredContent) throw invalidPanelResponse(name, family);
  return result.structuredContent;
}

export async function readCodexPanelResource<T>(bridge: CodexApp, uri: string, family: CodexPanelFamily): Promise<T> {
  const result = await bridge.app.readServerResource({ uri });
  const content = result.contents.find((content) => content.uri === uri);
  if (!content || !('text' in content)) throw invalidPanelResponse(uri, family);
  return JSON.parse(content.text) as T;
}

/** Posts one user-visible message that starts (or queues) an agent turn. */
export async function sendCodexPanelMessage(bridge: CodexApp, text: string, family: CodexPanelFamily): Promise<void> {
  const message = bridge.extensions.message;
  if (!message) throw unsupported(family, 'Conversation messaging is unavailable.');
  const result = await message.send({
    role: 'user',
    content: [{ type: 'text', text }],
    _meta: { 'openai/message': { target: 'active', send: true } },
  });
  if (result.isError) throw unsupported(family, `The ${family.label} was saved, but the host could not notify its conversation. Retry the notification.`);
}

export function invalidPanelResponse(source: string, family: CodexPanelFamily): StructuredError {
  return new StructuredError({ code: family.invalidCode, message: `The host returned an incomplete ${family.label} response from ${source}.` });
}

function toolFailure(result: CodexPanelToolResult, family: CodexPanelFamily): StructuredError {
  const failure = result.structuredContent?.error as { code?: unknown; message?: unknown } | undefined;
  if (failure && typeof failure.code === 'string' && typeof failure.message === 'string') {
    return new StructuredError({ code: failure.code, message: failure.message });
  }
  const text = result.content.find((content) => content.type === 'text')?.text;
  return new StructuredError({ code: family.invalidCode, message: text ?? `The ${family.label} action failed.` });
}

function unsupported(family: CodexPanelFamily, message: string): StructuredError {
  return new StructuredError({ code: family.unsupportedCode, message });
}
