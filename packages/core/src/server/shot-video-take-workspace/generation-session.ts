import type {
  GenerationContext,
  GenerationModelDescriptor,
  GenerationSpec,
  GenerationSpecRecord,
} from '../../client/generation.js';
import type {
  ShotVideoTakeGenerationSession,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelReport,
  ShotVideoTakeParameterReport,
} from '../../client/shot-video-take-workspace.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  listGenerationRunRecords,
  listGenerationSpecRecords,
} from '../database/access/media-generation.js';
import { readGenerationPurpose } from '../generation/purposes.js';
import { projectShotVideoTakeReferences } from './references.js';
import {
  durationSeconds,
  isShotVideoTakeGenerationParameter,
  orderShotVideoTakeGenerationParameters,
  shotVideoTakeParameterAllowedValues,
} from './generation-parameter-presentation.js';

export async function buildShotVideoTakeGenerationSession(input: {
  session: DatabaseSession;
  projectFolder: string;
  takeId: string;
  selectedShotId?: string;
}): Promise<ShotVideoTakeGenerationSession> {
  const target = { kind: 'sceneShotVideoTake' as const, id: input.takeId };
  const purpose = readGenerationPurpose('shot.video-take');
  const context = await purpose.buildContext({
    target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const spec = listGenerationSpecRecords(input.session, {
    purpose: 'shot.video-take',
    target,
  })[0] ?? null;
  const activeModel = findActiveModel(context, spec);
  const runs = spec
    ? listGenerationRunRecords(input.session, { specId: spec.id })
    : [];
  const run = runs[0] ?? null;
  const successfulRun = runs.find((candidate) => candidate.status === 'completed');
  return {
    context,
    spec,
    setup: {
      inputModeId: inputModeForSpec(spec?.spec ?? null, activeModel),
      ...(activeModel
        ? { modelChoice: modelChoice(activeModel.provider, activeModel.model) }
        : {}),
      parameterValues: parameterValues(spec?.spec ?? null, activeModel),
    },
    models: context.models.map(projectModel),
    authoringState: successfulRun
      ? { kind: 'completed', successfulRunId: successfulRun.id }
      : {
          kind: 'draft',
          failedAttemptCount: runs.filter((candidate) => candidate.status === 'failed').length,
        },
    references: projectShotVideoTakeReferences({
      session: input.session,
      guide: context.referenceGuide,
      spec: spec?.spec ?? null,
      model: activeModel,
      successfulRun,
      ...(input.selectedShotId ? { selectedShotId: input.selectedShotId } : {}),
    }),
    finalPrompt: promptDraft(spec?.spec ?? null, activeModel),
    estimate: null,
    run,
    diagnostics: [],
  };
}

export function modelIdentityFromChoice(
  context: GenerationContext,
  choice: string | undefined
) {
  return context.models.find(
    (model) => modelChoice(model.provider, model.model) === choice
  );
}

function findActiveModel(
  context: GenerationContext,
  spec: GenerationSpecRecord | null
) {
  if (spec?.spec.model?.provider && spec.spec.model.model) {
    return context.models.find(
      (model) =>
        model.provider === spec.spec.model?.provider &&
        model.model === spec.spec.model?.model
    );
  }
  return context.models[0];
}

function projectModel(model: GenerationModelDescriptor): ShotVideoTakeModelReport {
  const durationField = model.fields.find(
    (field) => field.semantic?.kind === 'setting' && field.semantic.role === 'duration'
  );
  const durationValues = durationField
    ? shotVideoTakeParameterAllowedValues(durationField)?.flatMap((value) => {
        const duration = durationSeconds(value);
        return duration === null ? [] : [duration];
      })
    : undefined;
  return {
    modelChoice: modelChoice(model.provider, model.model),
    provider: model.provider,
    model: model.model,
    label: model.label,
    supportedInputModes: supportedInputModes(model),
    duration: durationField
      ? {
          supported: true,
          ...(durationValues && durationValues.length > 0
            ? { values: durationValues }
            : {}),
          ...(durationField.minimum !== undefined ? { minimum: durationField.minimum } : {}),
          ...(durationField.maximum !== undefined ? { maximum: durationField.maximum } : {}),
        }
      : { supported: false },
    parameters: orderShotVideoTakeGenerationParameters(model.fields)
      .flatMap((field): ShotVideoTakeParameterReport[] =>
      !isShotVideoTakeGenerationParameter(field)
        ? []
        : [{
            name: field.name,
            label: field.label,
            required: field.required,
            ...(shotVideoTakeParameterAllowedValues(field)
              ? { allowedValues: shotVideoTakeParameterAllowedValues(field)! }
              : {}),
            ...(field.minimum !== undefined ? { minimum: field.minimum } : {}),
            ...(field.maximum !== undefined ? { maximum: field.maximum } : {}),
          }]
    ),
  };
}

function supportedInputModes(model: GenerationModelDescriptor): ShotVideoTakeInputModeId[] {
  const mediaRoles = new Set(
    model.fields.flatMap((field) =>
      field.semantic?.kind === 'media' ? [field.semantic.role] : []
    )
  );
  const result: ShotVideoTakeInputModeId[] = [];
  if (mediaRoles.size === 0) {
    result.push('text-only');
  }
  if (mediaRoles.has('first-frame') || mediaRoles.has('source-image')) {
    result.push('first-frame');
  }
  if (
    (mediaRoles.has('first-frame') || mediaRoles.has('source-image')) &&
    mediaRoles.has('last-frame')
  ) {
    result.push('first-last-frame');
  }
  if (mediaRoles.has('reference-image')) {
    result.push('reference');
  }
  if (mediaRoles.has('source-video')) {
    result.push('source-video-reference');
  }
  return result.length > 0 ? result : ['text-only'];
}

function inputModeForSpec(
  spec: GenerationSpec | null,
  model: GenerationModelDescriptor | undefined
): ShotVideoTakeInputModeId {
  if (!spec) {
    return 'first-frame';
  }
  const slots = new Set(
    spec.references
      .filter((selection) => selection.placement.kind === 'slot')
      .map((selection) => selection.placement.kind === 'slot' ? selection.placement.slotId : '')
  );
  if (slots.has('source-video')) {
    return 'source-video-reference';
  }
  if (slots.has('first-frame') && slots.has('last-frame')) {
    return 'first-last-frame';
  }
  if (slots.has('first-frame')) {
    return 'first-frame';
  }
  const audioFields = new Set(
    model?.fields.flatMap((field) =>
      field.semantic?.kind === 'media' && field.semantic.role === 'audio'
        ? [field.name]
        : []
    ) ?? []
  );
  if (spec.references.some((selection) =>
    !(selection.placement.kind === 'slot' && selection.placement.slotId === 'dialogue-audio') &&
    !(selection.providerField && audioFields.has(selection.providerField))
  )) {
    return 'reference';
  }
  return 'text-only';
}

function parameterValues(
  spec: GenerationSpec | null,
  model: GenerationModelDescriptor | undefined
) {
  if (!model) {
    return {};
  }
  const parameterNames = new Set(
    model.fields
      .filter((field) => !field.media && field.semantic?.kind !== 'authored-text')
      .map((field) => field.name)
  );
  return Object.fromEntries(
    Object.entries(spec?.values ?? {}).filter(([name]) => parameterNames.has(name))
  );
}

function promptDraft(
  spec: GenerationSpec | null,
  model: GenerationModelDescriptor | undefined
) {
  if (!spec || !model) {
    return null;
  }
  const promptField = model.fields.find(
    (field) => field.semantic?.kind === 'authored-text' && field.semantic.role === 'prompt'
  );
  const negativeField = model.fields.find(
    (field) => field.semantic?.kind === 'authored-text' && field.semantic.role === 'negative-prompt'
  );
  const prompt = promptField ? spec.values[promptField.name] : undefined;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return null;
  }
  const negativePrompt = negativeField ? spec.values[negativeField.name] : undefined;
  return {
    prompt,
    ...(typeof negativePrompt === 'string' ? { negativePrompt } : {}),
  };
}

function modelChoice(provider: string, model: string): string {
  return `${provider}/${model}`;
}
