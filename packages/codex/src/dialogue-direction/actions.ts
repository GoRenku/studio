import type {
  DialogueDirectionConsumeInput,
  DialogueDirectionConsumeResult,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionPanel,
  DialogueDirectionReportInput,
  DialogueDirectionSession,
} from './contracts.js';
import { directionError } from './diagnostics.js';
import { validateElevenV4Draft } from './eleven-v4/draft.js';
import { validateSeedAudioDraft } from './seed-audio/draft.js';
import { projectDialogueDirectionSession, readDialogueDirectionSession, readShotPlanTakes } from './session-projection.js';
import type { DialogueDirectionState } from './session-state.js';
import type { DraftValidator } from './validation.js';

const DRAFT_VALIDATORS: Record<DialogueDirectionPanel, DraftValidator> = {
  'eleven-v4': validateElevenV4Draft,
  'seed-audio': validateSeedAudioDraft,
};

export async function generateDirectionTake(
  state: DialogueDirectionState,
  input: { sessionId: string; draft: { panel: DialogueDirectionPanel } },
  homeDir?: string,
): Promise<DialogueDirectionGenerateReceipt> {
  const record = state.record(input.sessionId);
  if (input.draft.panel !== record.panel) {
    throw directionError('CODEX_DIALOGUE_DIRECTION_INVALID', `This session directs ${record.panel} drafts, not ${input.draft.panel}.`);
  }
  const draft = DRAFT_VALIDATORS[record.panel](input.draft, { lines: record.lines, voices: record.voices });
  const action = state.startAction(input.sessionId, draft);
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
    model: draft.turnRange.start === draft.turnRange.end ? route.speechModel : route.rangeModel,
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
  state.completeAction(input.sessionId, input.actionId, take.id);
  return projectDialogueDirectionSession(state.record(input.sessionId), takes);
}
