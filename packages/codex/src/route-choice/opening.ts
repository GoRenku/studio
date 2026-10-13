import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import {
  GENERATION_LANE_LABELS,
  MEDIA_PURPOSE_GENERATION_LANES,
} from '@gorenku/studio-core/client';
import {
  createProjectDataService,
  readDefaultModelList,
  readProviderCredentials,
} from '@gorenku/studio-core/server';
import { assertGenerationReviewCapability } from '../generation-review-capabilities.js';
import type { RouteChooseInput, RouteChooser } from './contracts.js';
import type { RouteChooserState } from './choice-state.js';
import { routeChoiceError, routeChoiceToolResult } from './diagnostics.js';
import { preselectRoute, routeChoiceProviderOptions } from './options.js';
import { routeChooseSchema } from './schemas.js';

export const ROUTE_CHOOSER_URI = 'ui://renku/route-chooser';

export function registerRouteChooserOpening(server: McpServer, state: RouteChooserState, homeDir?: string): void {
  registerAppTool(server, 'generation.route.choose', {
    title: 'Ask which provider and model to use',
    description: 'Show the Route Chooser inline, preselected from the lane default, so the user confirms or changes the provider and model for this generation. Requires a synced Default Model List. Return immediately and end the turn; the choice arrives as a message.',
    inputSchema: routeChooseSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: ROUTE_CHOOSER_URI, visibility: ['model'] } },
  }, (input) => routeChoiceToolResult(async () => {
    assertGenerationReviewCapability(server);
    const chooser = await openRouteChooser(state, input, homeDir);
    return {
      content: [{ type: 'text' as const, text: `Route Chooser ${chooser.choiceId} is open. End the turn now and wait. The user's choice arrives as a message; consume it once with generation.route.consume.` }],
      structuredContent: { chooser },
    };
  }));
}

export async function openRouteChooser(state: RouteChooserState, input: RouteChooseInput, homeDir?: string): Promise<RouteChooser> {
  if (MEDIA_PURPOSE_GENERATION_LANES[input.purpose] !== input.lane) {
    throw routeChoiceError('CODEX_ROUTE_CHOICE_INVALID', `${input.purpose} belongs to the ${MEDIA_PURPOSE_GENERATION_LANES[input.purpose]} lane, not ${input.lane}.`);
  }
  const projectData = createProjectDataService();
  const projectRef = await projectData.resolveStudioProjectRef({ projectName: input.project, homeDir });
  const [settings, models, credentials] = await Promise.all([
    projectData.readProjectSettings({ projectName: projectRef.name, homeDir }),
    readDefaultModelList({ homeDir }),
    readProviderCredentials({ homeDir }),
  ]);
  if (models.state === 'notSynced') {
    throw routeChoiceError(
      'CODEX_ROUTE_CHOICE_NOT_SYNCED',
      'The Default Model List has not been synced yet.',
      'Run renku generation default-models sync --file <media-producer>/references/default-models.json, then open the Route Chooser again.',
    );
  }
  const lane = settings.settings.generation[input.lane];
  const providers = routeChoiceProviderOptions(models.lanes[input.lane], credentials.providers);
  return state.create({
    choiceId: randomUUID(),
    lane: input.lane,
    laneLabel: GENERATION_LANE_LABELS[input.lane],
    purpose: input.purpose,
    providers,
    preselected: preselectRoute(providers, lane, input.suggested),
    chooseRouteBeforeGenerating: lane.chooseRouteBeforeGenerating,
  }, projectRef);
}
