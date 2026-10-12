import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { DialogueDirectionOpenInput, DialogueDirectionScript, DialogueDirectionScriptLayout, DialogueLineRange } from './contracts.js';
import { directionIssue } from './diagnostics.js';
import { turnsInRange, type DirectionContext } from './session-projection.js';
import { duplicateIssues, isSingleLine, lineRangeIssues, speakersInOrder } from './validation.js';

/** Opening input against Core context and the route, collected. */
export function directionOpeningIssues(input: DialogueDirectionOpenInput, context: DirectionContext): DiagnosticIssue[] {
  const lastLine = context.turns.at(-1)?.number ?? 0;
  const rangeIssues = lineRangeIssues(input.turnRange, { start: 1, end: lastLine }, ['turnRange']);
  if (rangeIssues.length > 0) return [...rangeIssues, ...speakerEntryIssues(input, context)];
  return [
    ...lineRangeIssues(input.initialSelection, input.turnRange, ['initialSelection']),
    ...(input.route.operations.lineRange === null && !isSingleLine(input.initialSelection)
      ? [directionIssue(['initialSelection'], 'This route directs one line per Take; select a single line.')]
      : []),
    ...speakerCoverageIssues(input, context),
    ...speakerEntryIssues(input, context),
    ...INITIAL_SCRIPT_ISSUES[input.route.scriptLayout](input),
  ];
}

const INITIAL_SCRIPT_ISSUES: Record<DialogueDirectionScriptLayout, (input: DialogueDirectionOpenInput) => DiagnosticIssue[]> = {
  'line-scripts': (input) => {
    const expected = lineNumbers(input.turnRange);
    const covered = input.initialScripts.every((script, index) => isSingleLine(script.turnRange) && script.turnRange.start === expected[index]);
    return covered && input.initialScripts.length === expected.length
      ? []
      : [directionIssue(['initialScripts'], `Line Scripts need one single-line script for each of lines ${input.turnRange.start}–${input.turnRange.end}, in order.`)];
  },
  'range-prompt': (input) => [
    ...input.initialScripts.flatMap((script, index) => [
      ...lineRangeIssues(script.turnRange, input.turnRange, ['initialScripts', index, 'turnRange']),
      ...(input.route.operations.lineRange === null && !isSingleLine(script.turnRange)
        ? [directionIssue(['initialScripts', index, 'turnRange'], 'This route directs one line per Take.')]
        : []),
    ]),
    ...duplicateIssues(input.initialScripts.map((script) => rangeKey(script)), ['initialScripts'], 'Script range'),
  ],
};

function speakerCoverageIssues(input: DialogueDirectionOpenInput, context: DirectionContext): DiagnosticIssue[] {
  const speakers = speakersInOrder(turnsInRange(context.turns, input.turnRange), ['turnRange']);
  const entries = input.speakers.map((speaker) => speaker.castMemberId);
  return [
    ...speakers.issues,
    ...speakers.castMemberIds
      .filter((castMemberId) => !entries.includes(castMemberId))
      .map((castMemberId) => directionIssue(['speakers'], `Cast Member ${castMemberId} speaks in the line range but has no speakers entry.`)),
    ...input.speakers.flatMap((speaker, index) => speakers.castMemberIds.includes(speaker.castMemberId)
      ? []
      : [directionIssue(['speakers', index, 'castMemberId'], `Cast Member ${speaker.castMemberId} does not speak in the line range.`)]),
  ];
}

function speakerEntryIssues(input: DialogueDirectionOpenInput, context: DirectionContext): DiagnosticIssue[] {
  return [
    ...duplicateIssues(input.speakers.map((speaker) => speaker.castMemberId), ['speakers'], 'Cast Member'),
    ...input.speakers.flatMap((speaker, index) => {
      const owned = (context.castVoicesByCastMemberId[speaker.castMemberId] ?? []).map((voice) => voice.castVoiceId);
      return [
        ...duplicateIssues(speaker.castVoiceIds, ['speakers', index, 'castVoiceIds'], 'Cast Voice'),
        ...speaker.castVoiceIds
          .filter((castVoiceId) => !owned.includes(castVoiceId))
          .map((castVoiceId) => directionIssue(['speakers', index, 'castVoiceIds'], `Cast Voice ${castVoiceId} does not belong to Cast Member ${speaker.castMemberId}.`)),
        ...(speaker.castVoiceIds.includes(speaker.initialCastVoiceId)
          ? []
          : [directionIssue(['speakers', index, 'initialCastVoiceId'], `Initial Cast Voice ${speaker.initialCastVoiceId} must be one of castVoiceIds.`)]),
      ];
    }),
  ];
}

function lineNumbers(range: DialogueLineRange): number[] {
  return Array.from({ length: Math.max(0, range.end - range.start + 1) }, (_, index) => range.start + index);
}

function rangeKey(script: DialogueDirectionScript): string {
  return `${script.turnRange.start}–${script.turnRange.end}`;
}
