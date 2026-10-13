import type { RouteChooser, RouteRespondInput } from '@gorenku/studio-codex/route-choice';
import type { CodexApp } from '@/services/codex-app';
import {
  callCodexPanelTool,
  connectCodexPanelApp,
  createCodexPanelApp,
  invalidPanelResponse,
  sendCodexPanelMessage,
  type CodexPanelFamily,
} from '@/services/codex-panel';

const ROUTE_CHOICE: CodexPanelFamily = {
  label: 'provider and model choice',
  invalidCode: 'CODEX_ROUTE_CHOICE_INVALID',
  unsupportedCode: 'CODEX_ROUTE_CHOICE_INVALID',
};

export function createRouteChooserApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'inline');
}

export function connectRouteChooserApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'inline', ROUTE_CHOICE);
}

export async function respondToRouteChooser(bridge: CodexApp, input: RouteRespondInput): Promise<RouteChooser> {
  const result = await callCodexPanelTool(bridge, 'generation.route.respond', { ...input }, ROUTE_CHOICE);
  const chooser = result.chooser as RouteChooser | undefined;
  if (!chooser) throw invalidPanelResponse('generation.route.respond', ROUTE_CHOICE);
  return chooser;
}

/** A neutral notice that names the answer; it carries no authority beyond starting the agent's turn. */
export function notifyRouteChoice(bridge: CodexApp, chooser: RouteChooser, subject: string | null): Promise<void> {
  const text = chooser.answer?.kind === 'chosen'
    ? `${chooser.laneLabel} route chosen · ${subject}. Chooser ${chooser.choiceId}. Consume it with generation.route.consume once.`
    : `${chooser.laneLabel} route choice canceled. Chooser ${chooser.choiceId}. Consume it with generation.route.consume once.`;
  return sendCodexPanelMessage(bridge, text, ROUTE_CHOICE);
}
