import type {
  DialogueDirectionConsumeInput,
  DialogueDirectionConsumeResult,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionReportInput,
  DialogueDirectionSession,
} from './contracts.js';
import { directionError } from './diagnostics.js';
import { operationForRange, validateDirectionDraft } from './draft-validation.js';
import { projectDialogueDirectionSession, readDialogueDirectionSession, readShotPlanTakes } from './session-projection.js';
import type { DialogueDirectionState } from './session-state.js';

export async function generateDirectionTake(
  state: DialogueDirectionState,
  input: { sessionId: string; draft: unknown },
  homeDir?: string,
): Promise<DialogueDirectionGenerateReceipt> {
  const record = state.record(input.sessionId);
  const draft = validateDirectionDraft(input.draft, { route: record.route, lines: record.lines, voices: record.voices });
  const action = state.startAction(input.sessionId, draft, { turnRange: { ...draft.turnRange } });
  return {
    sessionId: input.sessionId,
    actionId: action.actionId,
    turnRange: action.turnRange,
    session: await readDialogueDirectionSession(state, input.sessionId, homeDir),
  };
}

export function consumeDirectionAction(state: DialogueDirectionState, input: DialogueDirectionConsumeInput): DialogueDirectionConsumeResult {
  const draft = state.consume(input.sessionId, input.actionId);
  if (!draft) return { status: 'alreadyConsumed', sessionId: input.sessionId, actionId: input.actionId };
  const { binding, route } = state.record(input.sessionId);
  return {
    status: 'consumed',
    sessionId: input.sessionId,
    actionId: input.actionId,
    project: binding.projectRef.name,
    shotPlanId: binding.shotPlanId,
    provider: route.provider,
    model: operationForRange(route, draft.turnRange)!.model,
    draft,
  };
}

export async function reportDirectionAction(state: DialogueDirectionState, input: DialogueDirectionReportInput, homeDir?: string): Promise<DialogueDirectionSession> {
  const action = state.runningAction(input.sessionId, input.actionId);
  const takes = await readShotPlanTakes(state.record(input.sessionId).binding, homeDir);
  if (input.outcome.status === 'failed') {
    state.failAction(input.sessionId, input.actionId, input.outcome.message);
    return projectDialogueDirectionSession(state.record(input.sessionId), takes);
  }
  const { assetFileId } = input.outcome;
  const take = takes.find((candidate) => candidate.assetFile.id === assetFileId);
  if (!take) {
    throw directionError('CODEX_DIALOGUE_DIRECTION_INVALID', `Asset File ${assetFileId} is not an active dialogue Take of this Shot Plan.`, 'Import the generated audio with renku media import for this Shot Plan before reporting it attached.');
  }
  if (take.turnRange.start !== action.turnRange.start || take.turnRange.end !== action.turnRange.end) {
    throw directionError('CODEX_DIALOGUE_DIRECTION_INVALID', `The imported Take covers lines ${take.turnRange.start}–${take.turnRange.end}, but the action directed lines ${action.turnRange.start}–${action.turnRange.end}.`);
  }
  state.completeAction(input.sessionId, input.actionId, { actionId: input.actionId, takeId: take.id });
  return projectDialogueDirectionSession(state.record(input.sessionId), takes);
}
