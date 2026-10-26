import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { estimateCastingRoundCost, type CastingEstimatedCost, type CastingRoute, type CastingRoundCostEstimate, type CastingSettings } from '@gorenku/studio-core/client';
import { createProjectDataService, type StudioProjectRef } from '@gorenku/studio-core/server';
import { notifyPanelProjectWrite } from '../panel-sessions/project-notifications.js';
import type { CastingRound, CastingRoundConsumeResult, CastingRoundRespondInput } from './contracts.js';
import { ROUND_SUBJECT_DEFAULTS } from './subjects.js';
import { assertNoCastingRoundIssues, castingRoundError, castingRoundIssue, castingRoundToolResult } from './diagnostics.js';
import { findCastingRoundProvider } from './options.js';
import { castingRoundConsumeSchema, castingRoundRespondSchema } from './schemas.js';
import type { CastingRoundState, CastingRoundView } from './session-state.js';

export function registerCastingRoundTools(server: McpServer, state: CastingRoundState, homeDir?: string): void {
  registerAppTool(server, 'casting.round.respond', {
    title: 'Record the Casting round models and counts', inputSchema: castingRoundRespondSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingRoundToolResult(async () => ({ content: [], structuredContent: { round: await respondToCastingRound(state, input, homeDir) } })));
  registerAppTool(server, 'casting.round.consume', {
    title: 'Consume the Casting round',
    description: 'Consume the user\'s Casting round answer once. generate is the confirmed round plan and confirms every image in it: write one round per Look or costume of the subject with renku cast casting round create, then generate the images through Media Producer at the given concurrency and detail level, applying the native fields for that level from the Default Model List, and import each one into its round as soon as it finishes. canceled means stop quietly; alreadyConsumed authorizes nothing.',
    inputSchema: castingRoundConsumeSchema,
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingRoundToolResult(async () => ({ content: [], structuredContent: { ...consumeCastingRound(state, input.panelId) } })));
}

/** Records one answer; the subject's saved defaults change only when the user ticks the save box and generates. */
export async function respondToCastingRound(state: CastingRoundState, input: CastingRoundRespondInput, homeDir?: string): Promise<CastingRound> {
  const record = state.record(input.panelId);
  if (record.answer) {
    throw castingRoundError('CODEX_CASTING_ROUND_INVALID', 'This Casting round panel was already answered.');
  }
  if (input.choice.kind === 'canceled') {
    return state.answer(input.panelId, { kind: 'canceled' });
  }
  const { panel } = record;
  const routes = offeredRoutes(panel.options, input.choice.routes);
  const costumeIds = answeredCostumeIds(panel, input.choice.costumeIds);
  const { detail } = input.choice;
  const estimate = estimateCastingRoundCost({ options: panel.options, routes, detail, roundCount: costumeIds?.length ?? 1 });
  if (input.saveAsDefaults) {
    await saveRoundDefaults(record.context.projectRef, ROUND_SUBJECT_DEFAULTS[panel.subject.kind].save(routes, detail), homeDir);
  }
  return state.answer(input.panelId, {
    kind: 'generate',
    routes,
    maxConcurrentGenerations: input.choice.maxConcurrentGenerations,
    detail,
    ...(costumeIds ? { costumeIds } : {}),
    estimatedCost: estimatedCost(estimate),
    defaultsSaved: input.saveAsDefaults,
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
    subject: panel.subject.kind === 'look'
      ? { kind: 'look', lookId: panel.subject.look.id }
      : { kind: 'costumes', costumeIds: answer.costumeIds! },
    routes: answer.routes,
    maxConcurrentGenerations: answer.maxConcurrentGenerations,
    detail: answer.detail,
    referenceAssetFileIds: panel.references.map((reference) => reference.assetFileId),
    estimatedCost: estimatedCost(estimateCastingRoundCost({ options: panel.options, routes: answer.routes, detail: answer.detail, roundCount: 1 })),
  };
}

/** A costumes panel answers with the ticked subset of its costumes; a Look panel names none. */
function answeredCostumeIds(panel: CastingRoundView, costumeIds: string[] | undefined): string[] | undefined {
  if (panel.subject.kind === 'look') {
    assertNoCastingRoundIssues(costumeIds ? [castingRoundIssue(['choice', 'costumeIds'], 'A casting round for a Look has no costumes.')] : [], 'The Casting round answer is invalid.');
    return undefined;
  }
  const offered = new Set(panel.subject.costumes.map((costume) => costume.id));
  const ticked = costumeIds ?? [];
  assertNoCastingRoundIssues([
    ...(ticked.length === 0 ? [castingRoundIssue(['choice', 'costumeIds'], 'Tick at least one costume.')] : []),
    ...ticked.flatMap((costumeId, index) => offered.has(costumeId) && ticked.indexOf(costumeId) === index
      ? []
      : [castingRoundIssue(['choice', 'costumeIds', index], `${costumeId} is not an offered costume or is listed twice.`)]),
  ], 'The Casting round answer is invalid.');
  return panel.subject.costumes.map((costume) => costume.id).filter((costumeId) => ticked.includes(costumeId));
}

function estimatedCost(estimate: CastingRoundCostEstimate): CastingEstimatedCost | null {
  return estimate.amountUsd === null ? null : { amount: estimate.amountUsd, currency: 'USD' };
}

/** Saves the round's models, counts and detail as the subject's defaults, keeping the other defaults. */
async function saveRoundDefaults(projectRef: StudioProjectRef, defaults: Partial<CastingSettings>, homeDir?: string): Promise<void> {
  const projectData = createProjectDataService();
  const current = await projectData.showCastingSettings({ projectName: projectRef.name, homeDir });
  const report = await projectData.setCastingSettings({ projectName: projectRef.name, homeDir, casting: { ...current.casting, ...defaults } });
  await notifyPanelProjectWrite({ projectRef, resourceKeys: report.resourceKeys, tool: 'casting.round.respond', homeDir });
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
