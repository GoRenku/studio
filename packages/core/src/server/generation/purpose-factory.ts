import type { GenerationModelDescriptor, GenerationPurposeSettings } from '../../client/generation.js';
import { buildGenerationContext } from './context.js';
import type {
  BuildGenerationPurposeInput,
  GenerationPurposeDescriptor,
} from './purpose-contract.js';
import { buildGenerationPurposeFacts } from './purpose-context.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveAuthoredShotPlanContext } from './authored-shot-plan-context.js';
import {
  readProjectSettingsFromSession,
  resolveGenerationWorkflowPolicy,
} from '../project-settings/index.js';

export function defineGenerationPurpose(input: Omit<GenerationPurposeDescriptor, 'buildContext'>): GenerationPurposeDescriptor {
  const descriptor: GenerationPurposeDescriptor = {
    ...input,
    async buildContext(contextInput: BuildGenerationPurposeInput) {
      const authoredShotPlan = resolveAuthoredShotPlanContext({
        authoredFrom: contextInput.authoredFrom,
        session: contextInput.session,
      });
      const facts = {
        ...buildGenerationPurposeFacts({
          target: authoredShotPlan.sceneId
            ? { kind: 'scene', id: authoredShotPlan.sceneId }
            : contextInput.target,
          session: contextInput.session,
          authored: contextInput.facts,
        }),
        ...authoredShotPlan.facts,
      };
      const resolvedInput = {
        ...contextInput,
        facts,
        guideNotices: authoredShotPlan.notices,
      };
      const referenceGuide = await descriptor.buildReferenceGuide(resolvedInput);
      const settings = {
        ...descriptor.settings,
        recommended: descriptor.settings.recommended.map((setting) =>
          setting.kind === 'aspect-ratio' && setting.value === 'project' && typeof facts.projectAspectRatio === 'string'
            ? { ...setting, value: facts.projectAspectRatio }
            : setting
        ),
      };
      const models = await import('./purposes.js').then(({ listGenerationModels }) =>
        listGenerationModels({
          outputMediaKind: descriptor.outputMediaKind,
          fixedSettings: settings.fixed,
        })
      );
      if (models.length === 0) {
        throw new ProjectDataError(
          'CORE_GENERATION_PURPOSE_MODELS_UNAVAILABLE',
          `No selectable ${descriptor.outputMediaKind} model can represent the fixed settings for ${descriptor.purpose}.`
        );
      }
      const recommendedModel = resolveRecommendedModel(settings.recommendedModel, models);
      return buildGenerationContext({
        purpose: descriptor,
        target: contextInput.target,
        facts,
        settings: recommendedModel ? { ...settings, recommendedModel } : settings,
        models,
        referenceGuide,
        workflowPolicy: resolveGenerationWorkflowPolicy({
          settings: readProjectSettingsFromSession(contextInput.session).settings,
          outputMediaKind: descriptor.outputMediaKind,
        }),
      });
    },
  };
  return descriptor;
}

function resolveRecommendedModel(
  recommended: GenerationPurposeSettings['recommendedModel'],
  models: GenerationModelDescriptor[]
) {
  if (!recommended?.provider || !recommended.model) {
    return recommended;
  }
  const direct = models.find((model) => model.provider === recommended.provider && model.model === recommended.model);
  return direct ? recommended : undefined;
}

export const noSettings: GenerationPurposeSettings = { fixed: [], recommended: [] };
