import {
  listAvailableStudioVideoModelFamilies,
  readStudioVideoModelFamilyId,
  resolveStudioVideoRoute,
  routeKindForInputMode,
  shotPlanVideoDurationCapability,
} from '../../generation/shot-plan-video-model-authoring.js';
import { projectShotPlanVideoControls } from '../../generation/shot-plan-video-configurable-values.js';
import type {
  ShotPlanVideoInputMode,
} from '../../../client/generation.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { GenerationPreviewAuthoringStrategy } from './types.js';
import { validatedShotPlanVideoParameterValues } from '../../generation/shot-plan-video-configurable-values.js';
import {
  applyGenerationReferenceSlotSelection,
} from '../../generation/references.js';
import { routeShotPlanVideoReferences } from '../../generation/shot-plan-video-reference-routing.js';

const INPUT_MODES: Array<{
  id: ShotPlanVideoInputMode;
  label: string;
}> = [
  { id: 'text-only', label: 'Text only' },
  { id: 'first-frame', label: 'First frame' },
  { id: 'first-last-frame', label: 'First + last frame' },
  { id: 'reference', label: 'Reference' },
];

export const videoAuthoringStrategy: GenerationPreviewAuthoringStrategy = {
  async project(input) {
    const inputMode = input.preview.spec.shotPlanVideoInputMode;
    if (!inputMode) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_VIDEO_INPUT_MODE_REQUIRED',
        'Shot Plan video generation Preview requires an explicit input mode.',
      );
    }
    const families = await listAvailableStudioVideoModelFamilies(
      input.preview.models ?? [],
    );
    const selectedModelFamilyId =
      await readStudioVideoModelFamilyId(input.preview.spec.model) ??
      families[0]?.id;
    if (!selectedModelFamilyId) {
      return { kind: 'none' };
    }
    const selectedFamily = families.find(
      (family) => family.id === selectedModelFamilyId,
    );
    const resolved = await resolveStudioVideoRoute({
      modelFamilyId: selectedModelFamilyId,
      inputMode,
      availableModels: input.preview.models ?? [],
    });
    return {
      kind: 'video',
      selectedModelFamilyId,
      selectedInputMode: inputMode,
      inputModes: INPUT_MODES.map((mode) => ({
        ...mode,
        available: Boolean(
          selectedFamily?.routes[routeKindForInputMode(mode.id)]
        ),
      })),
      modelFamilies: families.map((family) => {
        const route = family.routes[routeKindForInputMode(inputMode)];
        const model = route
          ? input.preview.models?.find((candidate) =>
              candidate.provider === route.provider &&
              candidate.model === route.model
            )
          : undefined;
        return {
          familyId: family.id,
          label: family.label,
          available: Boolean(model),
          durationCapabilityLabel: model
            ? shotPlanVideoDurationCapability(model)
            : 'Unavailable for this input',
        };
      }),
      controls: projectShotPlanVideoControls({
        preview: input.preview,
        model: resolved.model,
        route: resolved.route,
      }),
    };
  },
  async update(input) {
    if (!input.shotPlanVideoInputMode) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_VIDEO_INPUT_MODE_REQUIRED',
        'Shot Plan video generation Preview requires an explicit input mode.',
      );
    }
    let spec = structuredClone(input.spec);
    for (const selection of input.slotSelections) {
      spec = applyGenerationReferenceSlotSelection(spec, selection);
    }
    const resolved = await resolveStudioVideoRoute({
      modelFamilyId: input.modelFamilyId,
      inputMode: input.shotPlanVideoInputMode,
      availableModels: input.availableModels,
    });
    const promptField = resolved.model.fields.find(
      (field) =>
        field.semantic?.kind === 'authored-text' &&
        field.semantic.role === 'prompt'
    );
    if (!promptField) {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_PROMPT_UNSUPPORTED',
        'The selected generation model does not expose an authored prompt field.',
      );
    }
    if (input.prompt.negativeText !== undefined) {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_NEGATIVE_PROMPT_UNSUPPORTED',
        'The selected Shot Plan video model does not expose a negative prompt field.',
      );
    }
    spec.model = {
      provider: resolved.route.provider,
      model: resolved.route.model,
    };
    spec.shotPlanVideoInputMode = input.shotPlanVideoInputMode;
    spec.values = {
      [promptField.name]: input.prompt.authoredText,
      ...validatedShotPlanVideoParameterValues({
        route: resolved.route,
        model: resolved.model,
        parameterValues: input.parameterValues,
      }),
    };
    return routeShotPlanVideoReferences({
      spec,
      inputMode: input.shotPlanVideoInputMode,
      model: resolved.model,
      session: input.session,
      projectFolder: input.projectFolder,
    });
  },
};
