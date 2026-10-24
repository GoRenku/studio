import type { CastingWardrobePanel, CastingWardrobeRespondInput } from '@gorenku/studio-codex/casting-wardrobe';
import type { CodexApp } from '@/services/codex-app';
import {
  callCodexPanelTool,
  connectCodexPanelApp,
  createCodexPanelApp,
  invalidPanelResponse,
  sendCodexPanelMessage,
  type CodexPanelFamily,
} from '@/services/codex-panel';

const CASTING_WARDROBE: CodexPanelFamily = {
  label: 'Looks and wardrobe plan',
  invalidCode: 'CODEX_CASTING_WARDROBE_INVALID',
  unsupportedCode: 'CODEX_CASTING_WARDROBE_INVALID',
};

export function createCastingWardrobeApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'inline');
}

export function connectCastingWardrobeApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'inline', CASTING_WARDROBE);
}

export async function respondToCastingWardrobe(bridge: CodexApp, input: CastingWardrobeRespondInput): Promise<CastingWardrobePanel> {
  const result = await callCodexPanelTool(bridge, 'casting.wardrobe.respond', { ...input }, CASTING_WARDROBE);
  const panel = result.panel as CastingWardrobePanel | undefined;
  if (!panel) throw invalidPanelResponse('casting.wardrobe.respond', CASTING_WARDROBE);
  return panel;
}

/** A neutral notice naming the plan; it starts the agent's turn and carries no approval. */
export function notifyCastingWardrobe(bridge: CodexApp, panel: CastingWardrobePanel, summary: string): Promise<void> {
  const subject = panel.mode === 'looks' ? 'Looks' : 'Wardrobe plan';
  const text = panel.answer?.kind === 'send'
    ? `${panel.mode === 'looks' ? 'Looks agreed' : 'Wardrobe plan'} · ${panel.castMember.name} · ${summary}. Plan ${panel.panelId}. Consume it with casting.wardrobe.consume once.`
    : `${subject} canceled · ${panel.castMember.name}. Plan ${panel.panelId}. Consume it with casting.wardrobe.consume once.`;
  return sendCodexPanelMessage(bridge, text, CASTING_WARDROBE);
}
