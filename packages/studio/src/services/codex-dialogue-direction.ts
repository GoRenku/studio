import { StructuredError } from '@gorenku/studio-diagnostics';
import type {
  DialogueDirectionGenerateInput,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionSession,
  DialogueDirectionTakeDiscardInput,
  DialogueDirectionTakeSelectInput,
  DialogueLineRange,
} from '@gorenku/studio-codex/dialogue-direction';
import { connectCodexAppHost, createCodexApp, type CodexApp } from '@/services/codex-app';

interface DialogueDirectionToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}

export function createDialogueDirectionApp(name: string): CodexApp {
  return createCodexApp(name, ['fullscreen']);
}

export async function connectDialogueDirectionApp(bridge: CodexApp): Promise<void> {
  const context = await connectCodexAppHost(bridge);
  if (context?.displayMode !== 'fullscreen') throw unsupported('This host did not open dialogue direction fullscreen.');
  if (!bridge.extensions.message) throw unsupported('This host cannot send dialogue direction to its conversation.');
}

export async function generateDialogueDirectionTake(bridge: CodexApp, input: DialogueDirectionGenerateInput): Promise<DialogueDirectionGenerateReceipt> {
  const result = await callDialogueDirectionTool(bridge, 'dialogue.direction.generate', { ...input });
  const receipt = result as unknown as Partial<DialogueDirectionGenerateReceipt>;
  if (!receipt.actionId || !receipt.session) throw invalidResponse('dialogue.direction.generate');
  return receipt as DialogueDirectionGenerateReceipt;
}

export async function selectDialogueDirectionTake(bridge: CodexApp, input: DialogueDirectionTakeSelectInput): Promise<DialogueDirectionSession> {
  return sessionFrom(await callDialogueDirectionTool(bridge, 'dialogue.direction.take.select', { ...input }), 'dialogue.direction.take.select');
}

export async function discardDialogueDirectionTake(bridge: CodexApp, input: DialogueDirectionTakeDiscardInput): Promise<DialogueDirectionSession> {
  return sessionFrom(await callDialogueDirectionTool(bridge, 'dialogue.direction.take.discard', { ...input }), 'dialogue.direction.take.discard');
}

export async function readDialogueDirectionSession(bridge: CodexApp, sessionId: string): Promise<DialogueDirectionSession> {
  const uri = `renku-direction://${sessionId}`;
  const result = await bridge.app.readServerResource({ uri });
  const content = result.contents.find((content) => content.uri === uri);
  if (!content || !('text' in content)) throw invalidResponse(uri);
  return JSON.parse(content.text) as DialogueDirectionSession;
}

export async function notifyDialogueDirectionGenerate(bridge: CodexApp, receipt: DialogueDirectionGenerateReceipt): Promise<void> {
  const message = bridge.extensions.message;
  if (!message) throw unsupported('Conversation messaging is unavailable.');
  const result = await message.send({
    role: 'user',
    content: [{ type: 'text', text: `Generate dialogue Take · ${receipt.session.shotPlan.title} · ${dialogueLineRangeLabel(receipt.turnRange)}. Session ${receipt.sessionId}, action ${receipt.actionId}. Consume it with dialogue.direction.consume once.` }],
    _meta: { 'openai/message': { target: 'active', send: true } },
  });
  if (result.isError) throw unsupported('The direction was saved, but the host could not notify its conversation. Retry the notification.');
}

export function dialogueLineRangeLabel(range: DialogueLineRange): string {
  return range.start === range.end ? `Line ${range.start}` : `Lines ${range.start}–${range.end}`;
}

async function callDialogueDirectionTool(bridge: CodexApp, name: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await bridge.app.callServerTool({ name, arguments: input }) as DialogueDirectionToolResult;
  if (result.isError) throw toolFailure(result);
  if (!result.structuredContent) throw invalidResponse(name);
  return result.structuredContent;
}

function sessionFrom(content: Record<string, unknown>, source: string): DialogueDirectionSession {
  const session = content.session as DialogueDirectionSession | undefined;
  if (!session) throw invalidResponse(source);
  return session;
}

function toolFailure(result: DialogueDirectionToolResult): StructuredError {
  const failure = result.structuredContent?.error as { code?: unknown; message?: unknown } | undefined;
  if (failure && typeof failure.code === 'string' && typeof failure.message === 'string') {
    return new StructuredError({ code: failure.code, message: failure.message });
  }
  const text = result.content.find((content) => content.type === 'text')?.text;
  return new StructuredError({ code: 'CODEX_DIALOGUE_DIRECTION_INVALID', message: text ?? 'The dialogue direction action failed.' });
}

function invalidResponse(source: string): StructuredError {
  return new StructuredError({ code: 'CODEX_DIALOGUE_DIRECTION_INVALID', message: `The host returned an incomplete dialogue direction response from ${source}.` });
}

function unsupported(message: string): StructuredError {
  return new StructuredError({ code: 'CODEX_DIALOGUE_DIRECTION_UNSUPPORTED', message });
}
