import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { nativeRequestControlList, nativeRequestValuesIssues } from '../native-request-controls/validation.js';
import type { DialogueDirectionDraft, DialogueDirectionLine, DialogueDirectionOperation, DialogueDirectionRoute, DialogueDirectionScriptLayout, DialogueDirectionVoice } from './contracts.js';
import { assertNoDirectionIssues, directionIssue } from './diagnostics.js';
import { dialogueDirectionDraftSchema } from './schemas.js';
import { isSingleLine, lineRangeIssues, linesInRange, parseDirectionInput, speakersInOrder, voiceAllowedIssues } from './validation.js';

/** Session facts a Generate draft is validated against. */
export interface DirectionDraftContext {
  route: DialogueDirectionRoute;
  lines: DialogueDirectionLine[];
  voices: Record<string, DialogueDirectionVoice[]>;
}

/** The operation a line range uses; null when the route cannot direct the range in one Take. */
export function operationForRange(route: DialogueDirectionRoute, range: DialogueDirectionDraft['turnRange']): DialogueDirectionOperation | null {
  return isSingleLine(range) ? route.operations.singleLine : route.operations.lineRange;
}

/** Validates a panel draft against the session route, collecting every issue. Direction text stays opaque. */
export function validateDirectionDraft(input: unknown, context: DirectionDraftContext): DialogueDirectionDraft {
  const draft = parseDirectionInput(dialogueDirectionDraftSchema, input, ['draft']);
  const bounds = { start: context.lines[0]?.number ?? 1, end: context.lines.at(-1)?.number ?? 0 };
  assertNoDirectionIssues(lineRangeIssues(draft.turnRange, bounds, ['draft', 'turnRange']), 'The panel draft is invalid.');
  const operation = operationForRange(context.route, draft.turnRange);
  if (!operation) {
    assertNoDirectionIssues([directionIssue(['draft', 'turnRange'], `${context.route.label} directs one line per Take; select a single line.`)], 'The panel draft is invalid.');
  }
  const rangeLines = linesInRange(context.lines, draft.turnRange);
  const speakers = speakersInOrder(rangeLines, ['draft', 'turnRange']);
  assertNoDirectionIssues([
    ...SCRIPT_ISSUES[context.route.scriptLayout](draft, rangeLines.map((line) => line.number)),
    ...speakers.issues,
    ...voiceLimitIssues(context.route, speakers.castMemberIds.length),
    ...voiceIssues(draft.voices, speakers.castMemberIds, context.voices),
    ...valueIssues(operation!, draft.values),
  ], 'The panel draft is invalid.');
  return draft;
}

const SCRIPT_ISSUES: Record<DialogueDirectionScriptLayout, (draft: DialogueDirectionDraft, lineNumbers: number[]) => DiagnosticIssue[]> = {
  'line-scripts': (draft, lineNumbers) => (
    draft.scripts.length === lineNumbers.length
    && draft.scripts.every((script, index) => isSingleLine(script.turnRange) && script.turnRange.start === lineNumbers[index])
      ? []
      : [directionIssue(['draft', 'scripts'], `Line Scripts must cover lines ${lineNumbers.join(', ')} once each, in screenplay order.`)]
  ),
  'range-prompt': (draft) => (
    draft.scripts.length === 1 && draft.scripts[0]!.turnRange.start === draft.turnRange.start && draft.scripts[0]!.turnRange.end === draft.turnRange.end
      ? []
      : [directionIssue(['draft', 'scripts'], 'A Range Prompt draft has exactly one script for the selected range.')]
  ),
};

function voiceLimitIssues(route: DialogueDirectionRoute, speakerCount: number): DiagnosticIssue[] {
  return speakerCount > route.maxVoices
    ? [directionIssue(['draft', 'turnRange'], `${route.label} takes up to ${route.maxVoices} voices; the selected lines have ${speakerCount} speakers.`)]
    : [];
}

/** One voice per speaker, in order of first appearance, from the offered Cast Voices. */
function voiceIssues(voices: DialogueDirectionDraft['voices'], speakers: string[], offered: Record<string, DialogueDirectionVoice[]>): DiagnosticIssue[] {
  const countIssues = voices.length === speakers.length
    ? []
    : [directionIssue(['draft', 'voices'], `Expected one voice for each of the ${speakers.length} speakers, in order of first appearance.`)];
  return [
    ...countIssues,
    ...voices.flatMap((voice, index) => [
      ...(voice.castMemberId === speakers[index] ? [] : [directionIssue(['draft', 'voices', index, 'castMemberId'], `Voice ${index + 1} must be for the speaker who appears in position ${index + 1}.`)]),
      ...voiceAllowedIssues(voice, offered, ['draft', 'voices', index]),
    ]),
  ];
}

/** Exactly the active operation's control keys, each valid. */
function valueIssues(operation: DialogueDirectionOperation, values: DialogueDirectionDraft['values']): DiagnosticIssue[] {
  return [
    ...nativeRequestControlList(operation.controls)
      .filter((control) => !Object.hasOwn(values, control.key))
      .map((control) => directionIssue(['draft', 'values', control.key], `${control.label} needs a value.`)),
    ...nativeRequestValuesIssues(operation.controls, values, directionIssue, ['draft', 'values']),
  ];
}
