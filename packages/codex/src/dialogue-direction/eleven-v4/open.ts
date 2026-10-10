import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { z } from 'zod';
import { assertGenerationReviewCapability } from '../../generation-review-capabilities.js';
import type { ElevenV4DialogueDirectionOpenInput } from '../contracts.js';
import { directionIssue, directionToolResult } from '../diagnostics.js';
import { directionOpeningResult, openDirectionSession } from '../opening.js';
import { directionIdentity, directionRouteSchema, directionSpeakerSchema, lineRangeSchema } from '../schemas.js';
import type { DialogueDirectionState } from '../session-state.js';
import { duplicateIssues } from '../validation.js';
import { elevenV4ActingLineSchema, elevenV4TakeActingScripts, elevenV4VoiceSettingsSchema } from './draft.js';

export const ELEVEN_V4_DIALOGUE_DIRECTION_URI = 'ui://renku/dialogue-direction/eleven-v4';

export const elevenV4DialogueDirectionOpenSchema = z.object({
  project: directionIdentity,
  shotPlanId: directionIdentity,
  route: directionRouteSchema,
  turnRange: lineRangeSchema.describe('Consecutive screenplay lines shown in the panel.'),
  initialSelection: lineRangeSchema.describe('Initially selected line or range, within turnRange.'),
  lines: z.array(elevenV4ActingLineSchema).min(1).describe('The agent acting script draft for every line in turnRange.'),
  speakers: z.array(directionSpeakerSchema).min(1),
  voiceSettings: elevenV4VoiceSettingsSchema,
  suggestedTags: z.array(z.string().min(1).max(200)).max(50).describe('Shown as insertable chips; never validated.'),
}).strict();

export function registerElevenV4DialogueDirectionOpening(server: McpServer, state: DialogueDirectionState, homeDir?: string): void {
  registerAppTool(server, 'dialogue.direction.eleven-v4.open', {
    title: 'Open Eleven v4 dialogue direction',
    description: 'Open the fullscreen Eleven v4 dialogue direction panel for one consecutive Shot Plan line range, pre-filled with acting scripts. Return immediately and end the turn. This tool never executes generation.',
    inputSchema: elevenV4DialogueDirectionOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: ELEVEN_V4_DIALOGUE_DIRECTION_URI, visibility: ['model'] } },
  }, (input) => directionToolResult(async () => {
    assertGenerationReviewCapability(server);
    return directionOpeningResult(await openElevenV4DialogueDirection(state, input, homeDir));
  }));
}

export function openElevenV4DialogueDirection(state: DialogueDirectionState, input: ElevenV4DialogueDirectionOpenInput, homeDir?: string) {
  return openDirectionSession(state, input, {
    panel: 'eleven-v4',
    issues: () => actingLineCoverageIssues(input),
    initial: (voices) => ({
      panel: 'eleven-v4',
      selection: input.initialSelection,
      actingScripts: Object.fromEntries(input.lines.map((line) => [line.number, line.actingScript])),
      voices,
      voiceSettings: input.voiceSettings,
      suggestedTags: input.suggestedTags,
    }),
    takeActingScripts: elevenV4TakeActingScripts,
  }, homeDir);
}

function actingLineCoverageIssues(input: ElevenV4DialogueDirectionOpenInput): DiagnosticIssue[] {
  const numbers = input.lines.map((line) => line.number);
  const missing = [];
  for (let number = input.turnRange.start; number <= input.turnRange.end; number += 1) {
    if (!numbers.includes(number)) missing.push(number);
  }
  return [
    ...duplicateIssues(numbers.map(String), ['lines'], 'Line'),
    ...numbers
      .filter((number) => number < input.turnRange.start || number > input.turnRange.end)
      .map((number) => directionIssue(['lines'], `Line ${number} lies outside turnRange.`)),
    ...missing.map((number) => directionIssue(['lines'], `Line ${number} has no acting script.`)),
  ];
}
