import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { UpdateGenerationLaneSettingsChange } from '@gorenku/studio-core/client';
import {
  createProjectDataService,
  createStudioOperationId,
  notifyStudioProjectResourcesChanged,
} from '@gorenku/studio-core/server';
import type { RouteChoiceSelection, RouteChooser, RouteConsumeResult, RouteRespondInput } from './contracts.js';
import type { RouteChooserRecord, RouteChooserState } from './choice-state.js';
import { routeChoiceError, routeChoiceToolResult } from './diagnostics.js';
import { isOffered } from './options.js';
import { routeConsumeSchema, routeRespondSchema } from './schemas.js';

export function registerRouteChoiceTools(server: McpServer, state: RouteChooserState, homeDir?: string): void {
  registerAppTool(server, 'generation.route.respond', {
    title: 'Record the chosen provider and model', inputSchema: routeRespondSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => routeChoiceToolResult(async () => ({ content: [], structuredContent: { chooser: await respondToRouteChooser(state, input, homeDir) } })));
  registerAppTool(server, 'generation.route.consume', {
    title: 'Consume the chosen provider and model',
    description: 'Consume the user\'s Route Chooser answer once. chosen returns the provider and model family to map to the exact operation route; canceled means stop quietly; alreadyConsumed means do nothing.',
    inputSchema: routeConsumeSchema,
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => routeChoiceToolResult(async () => ({ content: [], structuredContent: { ...consumeRouteChoice(state, input.choiceId) } })));
}

/** Records one answer; lane settings change only when the user chose a route. */
export async function respondToRouteChooser(state: RouteChooserState, input: RouteRespondInput, homeDir?: string): Promise<RouteChooser> {
  const record = state.record(input.choiceId);
  if (record.answer) {
    throw routeChoiceError('CODEX_ROUTE_CHOICE_INVALID', 'This Route Chooser was already answered.');
  }
  if (input.choice.kind === 'canceled') {
    return state.answer(input.choiceId, input.choice, false);
  }
  if (!isOffered(record.chooser.providers, input.choice)) {
    throw routeChoiceError('CODEX_ROUTE_CHOICE_INVALID', `${input.choice.provider} with model ${input.choice.model} is not one of the offered choices.`);
  }
  const change = laneChange(record, input.choice, input);
  if (change) {
    const report = await createProjectDataService().updateGenerationLaneSettings({ projectName: record.projectRef.name, homeDir, ...change });
    await notifyStudioProjectResourcesChanged({
      homeDir,
      notification: {
        projectRef: record.projectRef,
        resourceKeys: report.resourceKeys,
        source: { kind: 'cli', command: 'renku studio mcp generation.route.respond' },
        operationId: createStudioOperationId(),
      },
    });
  }
  return state.answer(input.choiceId, input.choice, Boolean(change));
}

export function consumeRouteChoice(state: RouteChooserState, choiceId: string): RouteConsumeResult {
  const record = state.consume(choiceId);
  if (!record) return { status: 'alreadyConsumed', choiceId };
  const answer = record.answer!;
  if (answer.kind === 'canceled') return { status: 'canceled', choiceId };
  const provider = record.chooser.providers.find((option) => option.provider === answer.provider)!;
  const model = provider.models.find((option) => option.key === answer.model)!;
  return {
    status: 'chosen',
    choiceId,
    chosen: { provider: provider.provider, providerLabel: provider.label, model: { key: model.key, name: model.name } },
    laneSettingsChanged: record.laneSettingsChanged,
  };
}

function laneChange(
  record: RouteChooserRecord,
  choice: RouteChoiceSelection,
  input: Pick<RouteRespondInput, 'saveAsLaneDefault' | 'chooseRouteBeforeGenerating'>,
): UpdateGenerationLaneSettingsChange | null {
  const change: UpdateGenerationLaneSettingsChange = { lane: record.chooser.lane };
  if (input.saveAsLaneDefault) {
    const model = record.chooser.providers
      .find((option) => option.provider === choice.provider)!.models
      .find((option) => option.key === choice.model)!;
    change.provider = choice.provider;
    change.model = { key: model.key, name: model.name };
  }
  if (input.chooseRouteBeforeGenerating !== record.chooser.chooseRouteBeforeGenerating) {
    change.chooseRouteBeforeGenerating = input.chooseRouteBeforeGenerating;
  }
  return Object.keys(change).length > 1 ? change : null;
}
