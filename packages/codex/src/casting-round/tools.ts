import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { estimateCastingRoundCost, type CastingRoute } from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { notifyPanelProjectWrite } from '../panel-sessions/project-notifications.js';
import type { CastingRound, CastingRoundConsumeResult, CastingRoundRespondInput } from './contracts.js';
import { assertNoCastingRoundIssues, castingRoundError, castingRoundIssue, castingRoundToolResult } from './diagnostics.js';
import { findCastingRoundProvider } from './options.js';
import { castingRoundConsumeSchema, castingRoundRespondSchema } from './schemas.js';
import type { CastingRoundState } from './session-state.js';

export function registerCastingRoundTools(server: McpServer, state: CastingRoundState, homeDir?: string): void {
  registerAppTool(server, 'casting.round.respond', {
    title: 'Record the Casting round models and counts', inputSchema: castingRoundRespondSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingRoundToolResult(async () => ({ content: [], structuredContent: { round: await respondToCastingRound(state, input, homeDir) } })));
  registerAppTool(server, 'casting.round.consume', {
    title: 'Consume the Casting round',
    description: 'Consume the user\'s Casting round answer once. generate is the confirmed round plan and confirms every candidate in it: write it with renku cast casting round create, then generate the candidates through Media Producer at the given concurrency and import each one as soon as it finishes. canceled means stop quietly; alreadyConsumed authorizes nothing.',
    inputSchema: castingRoundConsumeSchema,
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingRoundToolResult(async () => ({ content: [], structuredContent: { ...consumeCastingRound(state, input.panelId) } })));
}

/** Records one answer; the casting defaults change only when the user ticks the save box and generates. */
export async function respondToCastingRound(state: CastingRoundState, input: CastingRoundRespondInput, homeDir?: string): Promise<CastingRound> {
  const record = state.record(input.panelId);
  if (record.answer) {
    throw castingRoundError('CODEX_CASTING_ROUND_INVALID', 'This Casting round panel was already answered.');
  }
  if (input.choice.kind === 'canceled') {
    return state.answer(input.panelId, { kind: 'canceled' });
  }
  const routes = offeredRoutes(record.panel.options, input.choice.routes);
  const estimate = estimateCastingRoundCost(record.panel.options, routes);
  if (input.saveAsCastingDefaults) {
    const report = await createProjectDataService().setCastingSettings({ projectName: record.context.projectRef.name, homeDir, casting: { routes } });
    await notifyPanelProjectWrite({ projectRef: record.context.projectRef, resourceKeys: report.resourceKeys, tool: 'casting.round.respond', homeDir });
  }
  return state.answer(input.panelId, {
    kind: 'generate',
    routes,
    maxConcurrentGenerations: input.choice.maxConcurrentGenerations,
    estimatedCost: estimate.amountUsd === null ? null : { amount: estimate.amountUsd, currency: 'USD' },
    castingDefaultsSaved: input.saveAsCastingDefaults,
  });
}

export function consumeCastingRound(state: CastingRoundState, panelId: string): CastingRoundConsumeResult {
  const answer = state.consume(panelId);
  if (!answer) return { status: 'alreadyConsumed', panelId };
  if (answer.kind === 'canceled') return { status: 'canceled', panelId };
  const { panel } = state.record(panelId);
  return {
    status: 'generate',
    panelId,
    lookId: panel.look.id,
    routes: answer.routes,
    maxConcurrentGenerations: answer.maxConcurrentGenerations,
    referenceAssetFileIds: panel.references.map((reference) => reference.assetFileId),
    estimatedCost: answer.estimatedCost,
  };
}

/** Every route must be an offered model on one of its offered providers, one route per model; names come from the offered option. */
function offeredRoutes(options: CastingRound['options'], routes: CastingRoute[]): CastingRoute[] {
  const issues = routes.flatMap((route, index) => {
    if (!findCastingRoundProvider(options, route)) return [castingRoundIssue(['choice', 'routes', index], `${route.model.key} on ${route.provider} is not one of the offered models.`)];
    return routes.findIndex((other) => other.model.key === route.model.key) === index
      ? []
      : [castingRoundIssue(['choice', 'routes', index], `${route.model.key} is listed more than once.`)];
  });
  assertNoCastingRoundIssues(issues, 'The Casting round answer is invalid.');
  return routes.map((route) => {
    const { option, provider } = findCastingRoundProvider(options, route)!;
    return { provider: provider.provider, model: option.model, count: route.count };
  });
}
