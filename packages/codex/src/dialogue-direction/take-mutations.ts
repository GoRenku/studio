import { createProjectDataService, notifyStudioProjectResourcesChanged } from '@gorenku/studio-core/server';
import type { ShotPlanDialogueAudioMutationReport } from '@gorenku/studio-core/client';
import type { DialogueDirectionSession, DialogueDirectionTakeDiscardInput, DialogueDirectionTakeSelectInput } from './contracts.js';
import { projectDialogueDirectionSession } from './session-projection.js';
import type { DialogueDirectionState } from './session-state.js';

export async function selectDirectionTake(state: DialogueDirectionState, input: DialogueDirectionTakeSelectInput, homeDir?: string): Promise<DialogueDirectionSession> {
  const service = createProjectDataService();
  const take = takeInput(state, input, homeDir);
  const report = input.selected
    ? await service.selectShotPlanDialogueAudioTake(take)
    : await service.clearShotPlanDialogueAudioTakeSelection(take);
  return afterMutation(state, input.sessionId, report, homeDir);
}

export async function discardDirectionTake(state: DialogueDirectionState, input: DialogueDirectionTakeDiscardInput, homeDir?: string): Promise<DialogueDirectionSession> {
  const report = await createProjectDataService().discardShotPlanDialogueAudioTake(takeInput(state, input, homeDir));
  return afterMutation(state, input.sessionId, report, homeDir);
}

function takeInput(state: DialogueDirectionState, input: { sessionId: string; takeId: string }, homeDir?: string) {
  const { binding } = state.record(input.sessionId);
  return { projectName: binding.projectRef.name, shotPlanId: binding.shotPlanId, takeId: input.takeId, homeDir };
}

async function afterMutation(state: DialogueDirectionState, sessionId: string, report: ShotPlanDialogueAudioMutationReport, homeDir?: string): Promise<DialogueDirectionSession> {
  state.touch(sessionId);
  const record = state.record(sessionId);
  await notifyStudioProjectResourcesChanged({
    homeDir,
    notification: { projectRef: record.binding.projectRef, resourceKeys: report.resourceKeys, source: { kind: 'agent' } },
  });
  return projectDialogueDirectionSession(record, report.resource.takes);
}
