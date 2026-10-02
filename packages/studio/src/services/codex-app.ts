import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationReviewReceipt } from '@gorenku/studio-codex/client';
import type { CodexGenerationReviewDisplayMode } from '@gorenku/studio-core/client';

export function createCodexApp(name: string) {
  const app = new App({ name, version: import.meta.env.RENKU_RUNTIME_VERSION }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: true });
  const extensions = new OpenAIExtensions(app);
  app.addEventListener('hostcontextchanged', (context) => {
    if (context.theme) {
      applyDocumentTheme(context.theme);
      document.documentElement.classList.toggle('dark', context.theme === 'dark');
    }
    if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  });
  return { app, extensions };
}

export type CodexApp = ReturnType<typeof createCodexApp>;

export async function connectCodexApp(bridge: CodexApp, requireMessaging: boolean): Promise<CodexGenerationReviewDisplayMode> {
  await bridge.app.connect();
  const context = bridge.app.getHostContext();
  if (context?.theme) {
    applyDocumentTheme(context.theme);
    document.documentElement.classList.toggle('dark', context.theme === 'dark');
  }
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context?.displayMode !== 'inline' && context?.displayMode !== 'fullscreen') throw unsupported('This host did not open the review in a supported display mode.');
  if (requireMessaging && !bridge.extensions.message) throw unsupported('This host cannot send the review response to its conversation.');
  return context.displayMode;
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
