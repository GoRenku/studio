import { randomUUID } from 'node:crypto';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  DialogueDirectionPanel,
  DialogueDirectionRoute,
  DialogueDirectionSession,
  DialogueDirectionSpeakerInput,
  DialogueLineRange,
  ElevenV4DirectionInitial,
  SeedAudioDirectionInitial,
} from './contracts.js';
import { assertNoDirectionIssues, directionIssue } from './diagnostics.js';
import { projectDialogueDirectionSession, projectDirectionLines, projectDirectionVoices, readDirectionContext, readShotPlanTakes, turnsInRange, type DirectionContext } from './session-projection.js';
import { DialogueDirectionState, DirectionMediaRegistry, type TakeActingScriptsReader } from './session-state.js';
import { duplicateIssues, lineRangeIssues, speakersInOrder } from './validation.js';

export interface DirectionOpeningInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;
  turnRange: DialogueLineRange;
  initialSelection: DialogueLineRange;
  speakers: DialogueDirectionSpeakerInput[];
}

/** The panel-owned parts of opening a session. */
export interface DirectionPanelOpening {
  panel: DialogueDirectionPanel;
  issues: (context: DirectionContext) => DiagnosticIssue[];
  initial: (voices: Record<string, string>) => ElevenV4DirectionInitial | SeedAudioDirectionInitial;
  takeActingScripts: TakeActingScriptsReader | null;
}

export function directionOpeningResult(session: DialogueDirectionSession) {
  return {
    content: [{ type: 'text' as const, text: `Dialogue direction session ${session.sessionId} is open. End the turn now and wait. Each Generate click posts a message naming a session and action; consume it once with dialogue.direction.consume, execute through the provider Skill and CLI, then call dialogue.direction.report.` }],
    structuredContent: { session },
  };
}

export async function openDirectionSession(
  state: DialogueDirectionState,
  input: DirectionOpeningInput,
  opening: DirectionPanelOpening,
  homeDir?: string,
): Promise<DialogueDirectionSession> {
  const context = await readDirectionContext({ project: input.project, shotPlanId: input.shotPlanId, homeDir });
  assertNoDirectionIssues([...commonOpeningIssues(input, context), ...opening.issues(context)], 'The dialogue direction panel cannot open.');
  const sessionId = randomUUID();
  const media = new DirectionMediaRegistry(sessionId);
  const record = state.create(sessionId, media, {
    binding: context.binding,
    panel: opening.panel,
    route: input.route,
    shotPlan: context.shotPlan,
    lines: projectDirectionLines(turnsInRange(context.turns, input.turnRange), media),
    voices: projectDirectionVoices(context, input.speakers, media),
    initial: opening.initial(Object.fromEntries(input.speakers.map((speaker) => [speaker.castMemberId, speaker.initialCastVoiceId]))),
    takeActingScripts: opening.takeActingScripts,
  });
  return projectDialogueDirectionSession(record, await readShotPlanTakes(context.binding, homeDir));
}

function commonOpeningIssues(input: DirectionOpeningInput, context: DirectionContext): DiagnosticIssue[] {
  const lastLine = context.turns.at(-1)?.number ?? 0;
  const issues = lineRangeIssues(input.turnRange, { start: 1, end: lastLine }, ['turnRange']);
  if (issues.length > 0) return [...issues, ...speakerEntryIssues(input, context)];
  const speakers = speakersInOrder(turnsInRange(context.turns, input.turnRange), ['turnRange']);
  const entries = input.speakers.map((speaker) => speaker.castMemberId);
  return [
    ...lineRangeIssues(input.initialSelection, input.turnRange, ['initialSelection']),
    ...speakers.issues,
    ...speakers.castMemberIds
      .filter((castMemberId) => !entries.includes(castMemberId))
      .map((castMemberId) => directionIssue(['speakers'], `Cast Member ${castMemberId} speaks in the line range but has no speakers entry.`)),
    ...input.speakers.flatMap((speaker, index) => speakers.castMemberIds.includes(speaker.castMemberId)
      ? []
      : [directionIssue(['speakers', index, 'castMemberId'], `Cast Member ${speaker.castMemberId} does not speak in the line range.`)]),
    ...speakerEntryIssues(input, context),
  ];
}

function speakerEntryIssues(input: DirectionOpeningInput, context: DirectionContext): DiagnosticIssue[] {
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
