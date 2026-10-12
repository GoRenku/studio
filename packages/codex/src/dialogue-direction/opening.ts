import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { assertGenerationReviewCapability } from '../generation-review-capabilities.js';
import { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { DialogueDirectionOpenInput, DialogueDirectionSession } from './contracts.js';
import { assertNoDirectionIssues, directionToolResult } from './diagnostics.js';
import { directionOpeningIssues } from './opening-validation.js';
import { directionRouteIssues } from './route-validation.js';
import { dialogueDirectionOpenSchema } from './schemas.js';
import { projectDialogueDirectionSession, projectDirectionLines, projectDirectionVoices, readDirectionContext, readShotPlanTakes, turnsInRange } from './session-projection.js';
import { DIALOGUE_DIRECTION_MEDIA_SCHEME, type DialogueDirectionState } from './session-state.js';

export const DIALOGUE_DIRECTION_URI = 'ui://renku/dialogue-direction';

const OPENING_FAILURE = 'The dialogue direction panel cannot open.';

export function registerDialogueDirectionOpening(server: McpServer, state: DialogueDirectionState, homeDir?: string): void {
  registerAppTool(server, 'dialogue.direction.open', {
    title: 'Open dialogue direction',
    description: 'Open the fullscreen dialogue direction panel for one consecutive Shot Plan line range, described by the route\'s `## Codex panel` block and pre-filled with Direction Scripts. Return immediately and end the turn. This tool never executes generation.',
    inputSchema: dialogueDirectionOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: DIALOGUE_DIRECTION_URI, visibility: ['model'] } },
  }, (input) => directionToolResult(async () => {
    assertGenerationReviewCapability(server);
    return directionOpeningResult(await openDirectionSession(state, input, homeDir));
  }));
}

function directionOpeningResult(session: DialogueDirectionSession) {
  return {
    content: [{ type: 'text' as const, text: `Dialogue direction session ${session.sessionId} is open. End the turn now and wait. Each Generate click posts a message naming a session and action; consume it once with dialogue.direction.consume, execute through the provider Skill and CLI, then call dialogue.direction.report.` }],
    structuredContent: { session },
  };
}

export async function openDirectionSession(state: DialogueDirectionState, input: DialogueDirectionOpenInput, homeDir?: string): Promise<DialogueDirectionSession> {
  assertNoDirectionIssues(directionRouteIssues(input.route), OPENING_FAILURE);
  const context = await readDirectionContext({ project: input.project, shotPlanId: input.shotPlanId, homeDir });
  assertNoDirectionIssues(directionOpeningIssues(input, context), OPENING_FAILURE);
  const sessionId = randomUUID();
  const media = new PanelMediaRegistry(DIALOGUE_DIRECTION_MEDIA_SCHEME, sessionId);
  const record = state.create(sessionId, {
    binding: context.binding,
    route: input.route,
    shotPlan: context.shotPlan,
    lines: projectDirectionLines(turnsInRange(context.turns, input.turnRange), media),
    voices: projectDirectionVoices(context, input.speakers, media),
    initial: {
      selection: input.initialSelection,
      scripts: input.initialScripts,
      voices: Object.fromEntries(input.speakers.map((speaker) => [speaker.castMemberId, speaker.initialCastVoiceId])),
      suggestedTags: input.suggestedTags,
    },
    media,
  });
  return projectDialogueDirectionSession(record, await readShotPlanTakes(context.binding, homeDir));
}
