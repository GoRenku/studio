import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { z } from 'zod';
import { assertGenerationReviewCapability } from '../../generation-review-capabilities.js';
import type { SeedAudioDialogueDirectionOpenInput } from '../contracts.js';
import { directionIssue, directionToolResult } from '../diagnostics.js';
import { directionOpeningResult, openDirectionSession } from '../opening.js';
import { directionIdentity, directionRouteSchema, directionSpeakerSchema, lineRangeSchema } from '../schemas.js';
import type { DialogueDirectionState } from '../session-state.js';
import { duplicateIssues, lineRangeIssues } from '../validation.js';

export const SEED_AUDIO_DIALOGUE_DIRECTION_URI = 'ui://renku/dialogue-direction/seed-audio';

export const seedAudioDialogueDirectionOpenSchema = z.object({
  project: directionIdentity,
  shotPlanId: directionIdentity,
  route: directionRouteSchema.describe('Seed Audio uses the same route id for single-line and multi-line Takes.'),
  promptMentions: z.enum(['audio-tags', 'none']).describe('audio-tags when the provider route addresses voice references as @Audio1–3 in the prompt; none otherwise.'),
  turnRange: lineRangeSchema.describe('Consecutive screenplay lines shown in the panel.'),
  initialSelection: lineRangeSchema.describe('Initially selected line or range, within turnRange.'),
  prompts: z.array(z.object({ turnRange: lineRangeSchema, prompt: z.string() }).strict()).describe('Agent performance prompt drafts, one per exact line range.'),
  speakers: z.array(directionSpeakerSchema).min(1),
}).strict();

export function registerSeedAudioDialogueDirectionOpening(server: McpServer, state: DialogueDirectionState, homeDir?: string): void {
  registerAppTool(server, 'dialogue.direction.seed-audio.open', {
    title: 'Open Seed Audio dialogue direction',
    description: 'Open the fullscreen Seed Audio dialogue direction panel for one consecutive Shot Plan line range, pre-filled with performance prompts. Return immediately and end the turn. This tool never executes generation.',
    inputSchema: seedAudioDialogueDirectionOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: SEED_AUDIO_DIALOGUE_DIRECTION_URI, visibility: ['model'] } },
  }, (input) => directionToolResult(async () => {
    assertGenerationReviewCapability(server);
    return directionOpeningResult(await openSeedAudioDialogueDirection(state, input, homeDir));
  }));
}

export function openSeedAudioDialogueDirection(state: DialogueDirectionState, input: SeedAudioDialogueDirectionOpenInput, homeDir?: string) {
  return openDirectionSession(state, input, {
    panel: 'seed-audio',
    issues: () => seedAudioOpeningIssues(input),
    initial: (voices) => ({
      panel: 'seed-audio',
      selection: input.initialSelection,
      promptMentions: input.promptMentions,
      prompts: input.prompts,
      voices,
    }),
    takeActingScripts: null,
  }, homeDir);
}

function seedAudioOpeningIssues(input: SeedAudioDialogueDirectionOpenInput): DiagnosticIssue[] {
  return [
    ...(input.route.speechModel === input.route.rangeModel
      ? []
      : [directionIssue(['route'], 'Seed Audio uses one route id for single-line and multi-line Takes; speechModel and rangeModel must match.')]),
    ...input.prompts.flatMap((prompt, index) => lineRangeIssues(prompt.turnRange, input.turnRange, ['prompts', index, 'turnRange'])),
    ...duplicateIssues(input.prompts.map((prompt) => `${prompt.turnRange.start}–${prompt.turnRange.end}`), ['prompts'], 'Prompt range'),
  ];
}
