import type {
  DialogueDirectionGenerateInput,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionSession,
  DialogueDirectionTakeDiscardInput,
  DialogueDirectionTakeSelectInput,
  DialogueLineRange,
} from '@gorenku/studio-codex/dialogue-direction';
import type { CodexApp } from '@/services/codex-app';
import {
  callCodexPanelTool,
  connectCodexPanelApp,
  createCodexPanelApp,
  invalidPanelResponse,
  readCodexPanelResource,
  sendCodexPanelMessage,
  type CodexPanelFamily,
} from '@/services/codex-panel';

const DIALOGUE_DIRECTION: CodexPanelFamily = {
  label: 'dialogue direction',
  invalidCode: 'CODEX_DIALOGUE_DIRECTION_INVALID',
  unsupportedCode: 'CODEX_DIALOGUE_DIRECTION_UNSUPPORTED',
};

export function createDialogueDirectionApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'fullscreen');
}

export function connectDialogueDirectionApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'fullscreen', DIALOGUE_DIRECTION);
}

export async function generateDialogueDirectionTake(bridge: CodexApp, input: DialogueDirectionGenerateInput): Promise<DialogueDirectionGenerateReceipt> {
  const result = await callCodexPanelTool(bridge, 'dialogue.direction.generate', { ...input }, DIALOGUE_DIRECTION);
  const receipt = result as unknown as Partial<DialogueDirectionGenerateReceipt>;
  if (!receipt.actionId || !receipt.session) throw invalidPanelResponse('dialogue.direction.generate', DIALOGUE_DIRECTION);
  return receipt as DialogueDirectionGenerateReceipt;
}

export async function selectDialogueDirectionTake(bridge: CodexApp, input: DialogueDirectionTakeSelectInput): Promise<DialogueDirectionSession> {
  return sessionFrom(await callCodexPanelTool(bridge, 'dialogue.direction.take.select', { ...input }, DIALOGUE_DIRECTION), 'dialogue.direction.take.select');
}

export async function discardDialogueDirectionTake(bridge: CodexApp, input: DialogueDirectionTakeDiscardInput): Promise<DialogueDirectionSession> {
  return sessionFrom(await callCodexPanelTool(bridge, 'dialogue.direction.take.discard', { ...input }, DIALOGUE_DIRECTION), 'dialogue.direction.take.discard');
}

export function readDialogueDirectionSession(bridge: CodexApp, sessionId: string): Promise<DialogueDirectionSession> {
  return readCodexPanelResource<DialogueDirectionSession>(bridge, `renku-direction://${sessionId}`, DIALOGUE_DIRECTION);
}

/** A neutral notice naming the lines; it starts the agent's turn and carries no approval. */
export function notifyDialogueDirectionGenerate(bridge: CodexApp, receipt: DialogueDirectionGenerateReceipt): Promise<void> {
  return sendCodexPanelMessage(
    bridge,
    `Generate dialogue Take · ${receipt.session.shotPlan.title} · ${dialogueLineRangeLabel(receipt.turnRange)}. Session ${receipt.sessionId}, action ${receipt.actionId}. Consume it with dialogue.direction.consume once.`,
    DIALOGUE_DIRECTION,
  );
}

export function dialogueLineRangeLabel(range: DialogueLineRange): string {
  return range.start === range.end ? `Line ${range.start}` : `Lines ${range.start}–${range.end}`;
}

function sessionFrom(content: Record<string, unknown>, source: string): DialogueDirectionSession {
  const session = content.session as DialogueDirectionSession | undefined;
  if (!session) throw invalidPanelResponse(source, DIALOGUE_DIRECTION);
  return session;
}
