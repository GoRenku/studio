import type {
  ImageEditGenerateInput,
  ImageEditGenerateReceipt,
  ImageEditSession,
  ImageEditTargetChooser,
  ImageEditTargetRespondInput,
} from '@gorenku/studio-codex/image-edit';
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

const IMAGE_EDIT: CodexPanelFamily = {
  label: 'image edit',
  invalidCode: 'CODEX_IMAGE_EDIT_INVALID',
  unsupportedCode: 'CODEX_IMAGE_EDIT_UNSUPPORTED',
};

export function createImageEditApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'fullscreen');
}

export function connectImageEditApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'fullscreen', IMAGE_EDIT);
}

export async function generateImageEdit(bridge: CodexApp, input: ImageEditGenerateInput): Promise<ImageEditGenerateReceipt> {
  const result = await callCodexPanelTool(bridge, 'image.edit.generate', { ...input }, IMAGE_EDIT);
  const receipt = result as unknown as Partial<ImageEditGenerateReceipt>;
  if (!receipt.actionId || !receipt.session) throw invalidPanelResponse('image.edit.generate', IMAGE_EDIT);
  return receipt as ImageEditGenerateReceipt;
}

export function readImageEditSession(bridge: CodexApp, sessionId: string): Promise<ImageEditSession> {
  return readCodexPanelResource<ImageEditSession>(bridge, `renku-image-edit://${sessionId}`, IMAGE_EDIT);
}

/** A neutral notice naming the exact base version; it starts the agent's turn and carries no approval. */
export function notifyImageEditGenerate(bridge: CodexApp, receipt: ImageEditGenerateReceipt, subject: string): Promise<void> {
  return sendCodexPanelMessage(
    bridge,
    `Generate image edit · ${subject}. Session ${receipt.sessionId}, action ${receipt.actionId}. Consume it with image.edit.consume once.`,
    IMAGE_EDIT,
  );
}

export function createImageEditTargetChooserApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'inline');
}

export function connectImageEditTargetChooserApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'inline', IMAGE_EDIT);
}

export async function respondToImageEditTargetChooser(bridge: CodexApp, input: ImageEditTargetRespondInput): Promise<ImageEditTargetChooser> {
  const result = await callCodexPanelTool(bridge, 'image.edit.target.respond', { ...input }, IMAGE_EDIT);
  const chooser = result.chooser as ImageEditTargetChooser | undefined;
  if (!chooser) throw invalidPanelResponse('image.edit.target.respond', IMAGE_EDIT);
  return chooser;
}

export function notifyImageEditTargetChoice(bridge: CodexApp, chooser: ImageEditTargetChooser, subject: string | null): Promise<void> {
  const text = chooser.choice?.status === 'chosen'
    ? `Edit image chosen · ${subject}. Chooser ${chooser.chooserId}. Consume it with image.edit.target.consume once.`
    : `Image choice canceled. Chooser ${chooser.chooserId}. Consume it with image.edit.target.consume once.`;
  return sendCodexPanelMessage(bridge, text, IMAGE_EDIT);
}
