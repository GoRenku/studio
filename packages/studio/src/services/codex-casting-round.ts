import type { CastingRound, CastingRoundRespondInput } from '@gorenku/studio-codex/casting-round';
import type { CodexApp } from '@/services/codex-app';
import {
  callCodexPanelTool,
  connectCodexPanelApp,
  createCodexPanelApp,
  invalidPanelResponse,
  sendCodexPanelMessage,
  type CodexPanelFamily,
} from '@/services/codex-panel';

const CASTING_ROUND: CodexPanelFamily = {
  label: 'casting round',
  invalidCode: 'CODEX_CASTING_ROUND_INVALID',
  unsupportedCode: 'CODEX_CASTING_ROUND_INVALID',
};

export function createCastingRoundApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'fullscreen');
}

export function connectCastingRoundApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'fullscreen', CASTING_ROUND);
}

export async function respondToCastingRound(bridge: CodexApp, input: CastingRoundRespondInput): Promise<CastingRound> {
  const result = await callCodexPanelTool(bridge, 'casting.round.respond', { ...input }, CASTING_ROUND);
  const round = result.round as CastingRound | undefined;
  if (!round) throw invalidPanelResponse('casting.round.respond', CASTING_ROUND);
  return round;
}

/** A neutral notice naming the round; it starts the agent's turn and carries no approval. */
export function notifyCastingRound(bridge: CodexApp, round: CastingRound, summary: string): Promise<void> {
  const subject = `${round.castMember.name} · ${round.look.name}`;
  const text = round.answer?.kind === 'generate'
    ? `Casting round ready · ${subject} · ${summary}. Round panel ${round.panelId}. Consume it with casting.round.consume once.`
    : `Casting round canceled · ${subject}. Round panel ${round.panelId}. Consume it with casting.round.consume once.`;
  return sendCodexPanelMessage(bridge, text, CASTING_ROUND);
}
