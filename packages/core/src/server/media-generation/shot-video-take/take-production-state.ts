import type {
  SceneShotVideoTakeProductionState,
} from '../../../client/index.js';

export function carryTakeProductionStateForShotMembership(input: {
  production: SceneShotVideoTakeProductionState;
  previousShotIds: string[];
  nextShotIds: string[];
}): SceneShotVideoTakeProductionState {
  const membershipChanged = !sameShotIds(
    input.previousShotIds,
    input.nextShotIds
  );
  const requestedInputs = input.production.requestedInputs
    ?.filter(
      (requestedInput) =>
        requestedInput.subjectKind !== 'shot' ||
        !requestedInput.subjectId ||
        input.nextShotIds.includes(requestedInput.subjectId)
    )
    .map((requestedInput) => ({ ...requestedInput }));
  const agentProposal = input.production.agentProposal
    ? {
        ...input.production.agentProposal,
        ...(membershipChanged
          ? {
              basedOnShotIds:
                input.production.agentProposal.basedOnShotIds ??
                [...input.previousShotIds],
            }
          : {}),
        dependencyDrafts: input.production.agentProposal.dependencyDrafts.map(
          (draft) => ({ ...draft })
        ),
        ...(input.production.agentProposal.finalPromptDraft
          ? {
              finalPromptDraft: {
                ...input.production.agentProposal.finalPromptDraft,
              },
            }
          : {}),
      }
    : undefined;

  return {
    ...(input.production.inputModeId
      ? { inputModeId: input.production.inputModeId }
      : {}),
    ...(input.production.modelChoice
      ? { modelChoice: input.production.modelChoice }
      : {}),
    ...(input.production.parameterValues
      ? { parameterValues: { ...input.production.parameterValues } }
      : {}),
    ...(requestedInputs && requestedInputs.length > 0
      ? { requestedInputs }
      : {}),
    ...(!membershipChanged && input.production.preparedInputs
      ? {
          preparedInputs: input.production.preparedInputs.map(
            (preparedInput) => ({
              ...preparedInput,
            })
          ),
        }
      : {}),
    ...(agentProposal ? { agentProposal } : {}),
    ...(input.production.customPromptNote
      ? { customPromptNote: input.production.customPromptNote }
      : {}),
  };
}

function sameShotIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((shotId, index) => shotId === right[index])
  );
}
