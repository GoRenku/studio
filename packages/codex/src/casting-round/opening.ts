import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import {
  createProjectDataService,
  readDefaultModelList,
  readProviderCredentials,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import { assertGenerationReviewCapability } from '../generation-review-capabilities.js';
import type { GenerationCostEstimator } from '../generation-review-estimate.js';
import { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { CastingRound, CastingRoundOpenInput, CastingRoundReference } from './contracts.js';
import { assertNoCastingRoundIssues, castingRoundError, castingRoundIssue, castingRoundToolResult } from './diagnostics.js';
import { estimateCastingRoundOptions } from './estimates.js';
import { CASTING_ROUND_DEFAULT_TOTAL, castingRoundInputIssues, castingRoundOptions, preselectCastingRoutes } from './options.js';
import { CASTING_ROUND_MAX_COUNT_PER_MODEL, castingRoundOpenSchema } from './schemas.js';
import { CASTING_ROUND_SCHEME, type CastingRoundState } from './session-state.js';

export const CASTING_ROUND_URI = 'ui://renku/casting-round';

export function registerCastingRoundOpening(server: McpServer, state: CastingRoundState, estimator: GenerationCostEstimator, homeDir?: string): void {
  registerAppTool(server, 'casting.round.open', {
    title: 'Open the Casting round panel',
    description: 'Show the Casting round panel for one Look: brief, identity references, models, counts and approximate costs from local image prices. Requires a synced Default Model List. Supply the brief and optional strength notes; prices need no preparation or provider calls. Return immediately and end the turn; the round arrives as a message. This tool never executes generation.',
    inputSchema: castingRoundOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
    _meta: { ui: { resourceUri: CASTING_ROUND_URI, visibility: ['model'] } },
  }, (input) => castingRoundToolResult(async () => {
    assertGenerationReviewCapability(server);
    const round = await openCastingRound(state, input, estimator, homeDir);
    return {
      content: [{ type: 'text' as const, text: `Casting round panel ${round.panelId} is open. End the turn now and wait. The user's round arrives as a message; consume it once with casting.round.consume.` }],
      structuredContent: { round },
    };
  }));
}

export async function openCastingRound(
  state: CastingRoundState,
  input: CastingRoundOpenInput,
  estimator: GenerationCostEstimator,
  homeDir?: string,
): Promise<CastingRound> {
  const projectData = createProjectDataService();
  const projectRef = await projectData.resolveStudioProjectRef({ projectName: input.project, homeDir });
  const [{ look }, settings, models, credentials] = await Promise.all([
    projectData.showCastingLook({ projectName: projectRef.name, homeDir, lookId: input.lookId }),
    projectData.readProjectSettings({ projectName: projectRef.name, homeDir }),
    readDefaultModelList({ homeDir }),
    readProviderCredentials({ homeDir }),
  ]);
  if (models.state === 'notSynced') {
    throw castingRoundError(
      'CODEX_CASTING_ROUND_NOT_SYNCED',
      'The Default Model List has not been synced yet.',
      'Run renku generation default-models sync --file <media-producer>/references/default-models.json, then open the Casting round panel again.',
    );
  }
  const entries = models.lanes.image;
  assertNoCastingRoundIssues(castingRoundInputIssues(entries, input), 'The Casting round panel cannot open.');
  const { castMember } = await projectData.readCastCastingResource({ projectName: projectRef.name, homeDir, castMemberId: look.castMemberId });
  const panelId = randomUUID();
  const media = new PanelMediaRegistry(CASTING_ROUND_SCHEME, panelId);
  const lane = settings.settings.generation.image;
  const optionRecords = castingRoundOptions(entries, credentials.providers, input.notes ?? {}, lane.provider);
  const preselected = preselectCastingRoutes(optionRecords, { suggested: input.suggested, saved: settings.settings.casting.routes, lane });
  const [options, references] = await Promise.all([
    estimateCastingRoundOptions(optionRecords, estimator),
    readCastingRoundReferences(projectRef, input.references ?? [], media, homeDir),
  ]);
  const round = state.create({
    panelId,
    castMember,
    look: { id: look.id, name: look.name },
    brief: input.brief,
    references,
    options,
    preselected,
    initialTotal: preselected.reduce((total, route) => total + route.count, 0) || CASTING_ROUND_DEFAULT_TOTAL,
    maxCountPerModel: CASTING_ROUND_MAX_COUNT_PER_MODEL,
    maxConcurrentGenerations: lane.maxConcurrentGenerations,
  }, { projectRef, media });
  return round;
}

/** Reads each reference's project file for its thumbnail; ownership is checked by Core when the round is created. */
async function readCastingRoundReferences(projectRef: StudioProjectRef, assetFileIds: string[], media: PanelMediaRegistry, homeDir?: string): Promise<CastingRoundReference[]> {
  const repeated = assetFileIds.flatMap((assetFileId, index) => assetFileIds.indexOf(assetFileId) === index ? [] : [castingRoundIssue(['references', index], `Reference ${assetFileId} is listed more than once.`)]);
  assertNoCastingRoundIssues(repeated, 'The Casting round panel cannot open.');
  const projectData = createProjectDataService();
  return Promise.all(assetFileIds.map(async (assetFileId) => {
    const { assetFile } = await projectData.resolveProjectAssetFileById({ projectName: projectRef.name, homeDir, assetFileId });
    return { assetFileId, imageUri: media.uri(assetFile.projectRelativePath) };
  }));
}
