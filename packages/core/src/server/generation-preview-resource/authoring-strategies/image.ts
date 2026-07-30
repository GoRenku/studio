import {
  readStudioImageModelRouteProfile,
} from '@gorenku/studio-engines';
import {
  listAvailableStudioImageModelFamilies,
  readStudioImageModelFamilyId,
} from '../../generation/image-model-authoring.js';
import { projectStudioImageControls } from '../../generation/image-configurable-values.js';
import { validatedStudioImageParameterValues } from '../../generation/image-configurable-values.js';
import { resolveStudioImageRoute } from '../../generation/image-model-authoring.js';
import {
  applyGenerationReferenceSlotSelection,
  allocateGenerationReferencePromptMention,
  resolveGenerationReference,
} from '../../generation/references.js';
import {
  routeGenerationPreviewReferences,
} from '../authoring.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { GenerationPreviewAuthoringStrategy } from './types.js';

export const imageAuthoringStrategy: GenerationPreviewAuthoringStrategy = {
  async project(input) {
    if (!input.model) {
      return { kind: 'none' };
    }
    const [families, selectedModelFamilyId, route] = await Promise.all([
      listAvailableStudioImageModelFamilies(input.preview.models ?? []),
      readStudioImageModelFamilyId(input.preview.spec.model),
      readStudioImageModelRouteProfile({
        provider: input.model.provider,
        model: input.model.model,
      }),
    ]);
    if (!selectedModelFamilyId || !route) {
      return { kind: 'none' };
    }
    return {
      kind: 'image',
      selectedModelFamilyId,
      modelFamilies: families.map((family) => ({
        familyId: family.id,
        label: family.label,
      })),
      controls: projectStudioImageControls({
        preview: input.preview,
        model: input.model,
        route,
      }),
    };
  },
  async update(input) {
    let spec = structuredClone(input.spec);
    for (const selection of input.slotSelections) {
      spec = applyGenerationReferenceSlotSelection(spec, selection);
      if (!selection.reference) {
        continue;
      }
      const resolved = await resolveGenerationReference({
        session: input.session,
        projectFolder: input.projectFolder,
        reference: selection.reference,
      });
      if (resolved?.mediaKind === 'image') {
        spec = allocateGenerationReferencePromptMention({
          spec,
          placement: selection.placement,
        });
      }
    }
    const resolvedReferences = await Promise.all(spec.references.map((selection) =>
      resolveGenerationReference({
        session: input.session,
        projectFolder: input.projectFolder,
        reference: selection.reference,
      })
    ));
    const resolvedRoute = await resolveStudioImageRoute({
      modelFamilyId: input.modelFamilyId,
      hasSelectedImageReferences: resolvedReferences.some(
        (reference) => reference?.mediaKind === 'image',
      ),
      availableModels: input.availableModels,
    });
    const promptField = resolvedRoute.model.fields.find(
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
    const negativeField = resolvedRoute.model.fields.find(
      (field) =>
        field.semantic?.kind === 'authored-text' &&
        field.semantic.role === 'negative-prompt'
    );
    if (input.prompt.negativeText !== undefined && !negativeField) {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_NEGATIVE_PROMPT_UNSUPPORTED',
        'The selected generation model does not expose a negative prompt field.',
      );
    }
    spec.model = {
      provider: resolvedRoute.route.provider,
      model: resolvedRoute.route.model,
    };
    spec.values = {
      [promptField.name]: input.prompt.authoredText,
      ...validatedStudioImageParameterValues({
        route: resolvedRoute.route,
        model: resolvedRoute.model,
        parameterValues: input.parameterValues,
      }),
    };
    if (
      negativeField &&
      input.prompt.negativeText !== undefined &&
      input.prompt.negativeText !== null
    ) {
      spec.values[negativeField.name] = input.prompt.negativeText;
    }
    return routeGenerationPreviewReferences({
      spec,
      model: resolvedRoute.model,
      session: input.session,
      projectFolder: input.projectFolder,
    });
  },
};
