import { App, applyDocumentTheme, applyHostStyleVariables, type McpUiDisplayMode, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationReviewReceipt } from '@gorenku/studio-codex/client';
import type { CodexGenerationReviewDisplayMode } from '@gorenku/studio-core/client';

export function createCodexApp(name: string, availableDisplayModes: McpUiDisplayMode[]) {
  const app = new App({ name, version: import.meta.env.RENKU_RUNTIME_VERSION }, { availableDisplayModes }, { autoResize: true });
  const extensions = new OpenAIExtensions(app);
  app.addEventListener('hostcontextchanged', applyCodexHostAppearance);
  return { app, extensions };
}

export type CodexApp = ReturnType<typeof createCodexApp>;

export async function connectCodexAppHost(bridge: CodexApp): Promise<McpUiHostContext | undefined> {
  await bridge.app.connect();
  const context = bridge.app.getHostContext();
  if (context) applyCodexHostAppearance(context);
  return context;
}

export async function connectCodexApp(bridge: CodexApp, requireMessaging: boolean): Promise<CodexGenerationReviewDisplayMode> {
  const context = await connectCodexAppHost(bridge);
  if (context?.displayMode !== 'inline' && context?.displayMode !== 'fullscreen') throw unsupported('This host did not open the review in a supported display mode.');
  if (requireMessaging && !bridge.extensions.message) throw unsupported('This host cannot send the review response to its conversation.');
  return context.displayMode;
}

export async function readCodexAppMediaBlob(bridge: CodexApp, uri: string): Promise<Blob> {
  let result;
  try {
    result = await bridge.app.readServerResource({ uri });
  } catch (failure) {
    const code = failure !== null && typeof failure === 'object' && 'code' in failure && typeof failure.code === 'number' ? failure.code : undefined;
    throw new StructuredError({ code: 'CODEX_REFERENCE_READ_FAILED', message: `The host could not read this reference${code === undefined ? '.' : ` (MCP ${code}).`}` });
  }
  const content = result.contents.find((content) => content.uri === uri);
  if (!content || !('blob' in content) || !content.mimeType) throw new StructuredError({ code: 'CODEX_REFERENCE_BYTES_MISSING', message: 'The host returned a reference without its media bytes.' });
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(content.blob), (character) => character.charCodeAt(0));
  } catch {
    throw new StructuredError({ code: 'CODEX_REFERENCE_BYTES_INVALID', message: 'The host returned invalid reference bytes.' });
  }
  return new Blob([bytes], { type: content.mimeType });
}

function applyCodexHostAppearance(context: Pick<McpUiHostContext, 'theme' | 'styles'>): void {
  if (context.theme) {
    applyDocumentTheme(context.theme);
    document.documentElement.classList.toggle('dark', context.theme === 'dark');
  }
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
}

export async function notifyGenerationReviewAction(bridge: CodexApp, action: GenerationReviewReceipt): Promise<void> {
  const message = bridge.extensions.message;
  if (!message) throw unsupported('Conversation messaging is unavailable.');
  const descriptions = {
    submit: 'Submit and generate: continue the reviewed generation through Media Producer.',
    reconfigure: 'Prepare the selected provider/model in the same generation review. Do not execute generation.',
    cancel: 'Cancel this generation review. Do not generate.',
  };
  const result = await message.send({
    role: 'user',
    content: [{ type: 'text', text: `${descriptions[action.action]} Review ${action.reviewId}, response ${action.responseId}, revision ${action.revision}. Consume this exact action with generation.review.consume once.` }],
    _meta: { 'openai/message': { target: 'active', send: true } },
  });
  if (result.isError) throw unsupported('The response was saved, but the host could not notify its conversation. Retry the notification.');
}

function unsupported(message: string): StructuredError {
  return new StructuredError({ code: 'CODEX_REVIEW_UNSUPPORTED', message });
}
