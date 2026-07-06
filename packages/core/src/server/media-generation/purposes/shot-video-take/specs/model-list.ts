import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  ShotVideoTakeModelListReport,
  ShotVideoTakeInputGenerationPurpose,
  ShotVideoTakeInputModelListReport,
  ShotVideoTakeProductionContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeInputModelChoiceReport,
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeShotGroupMode,
  ShotVideoTakeModelChoice,
} from '../../../../../client/index.js';
import type {
  ShotVideoTakeModelListInput,
  ShotVideoTakeContextInput,
} from '../../../../project-data-service-contracts.js';
import {
  SHOT_VIDEO_MODEL_FAMILIES,
} from '@gorenku/studio-engines';
import {
  buildShotVideoTakeContext,
} from '../authoring/context.js';
import {
  defaultShotInputParameterValues,
  type ShotInputRouteKind,
} from '../shared/purpose-config.js';
import {
  durationSupportForRoute,
  inputRolesForRoute,
  parametersForRoute,
} from '../shared/route-settings.js';



export async function listShotVideoTakeModels(
  input: ShotVideoTakeModelListInput
): Promise<ShotVideoTakeModelListReport> {
  const context = await buildShotVideoTakeContext(input);
  const inputModeId = input.inputModeId ?? context.defaults.inputModeId;
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: context.target,
    ...(input.inputModeId ? { inputModeId: input.inputModeId } : {}),
    shotGroupMode: context.shotGroupMode,
    defaultModelChoice: defaultModelChoiceForInputMode(inputModeId),
    models: modelChoices(context, input.inputModeId),
  };
}



export async function listShotInputModels(
  input: ShotVideoTakeContextInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<ShotVideoTakeInputModelListReport> {
  const context = await buildShotVideoTakeContext(input);
  return {
    purpose,
    target: context.target,
    defaultModelChoice: context.defaults.imageDependencyModelChoice,
    models: shotInputModelChoices(),
  };
}



export function modelFamilyLabel(
  family: (typeof SHOT_VIDEO_MODEL_FAMILIES)[number]
): string {
  return family.version ? `${family.label} ${family.version}` : family.label;
}



export function modelChoices(
  context: ShotVideoTakeProductionContext,
  inputModeId?: ShotVideoTakeInputModeId
): ShotVideoTakeModelChoiceReport[] {
  const selectedInputMode = inputModeId ?? context.defaults.inputModeId;
  const models = SHOT_VIDEO_MODEL_FAMILIES.map((family) =>
    modelReport(family, selectedInputMode, context.shotGroupMode)
  );
  return models.map((model) => ({
    ...model,
    available: !inputModeId || model.supportedInputModes.includes(inputModeId),
    ...(!inputModeId || model.supportedInputModes.includes(inputModeId)
      ? {}
      : { unavailableReason: `This model does not support ${inputModeId}.` }),
  }));
}



export function shotInputModelChoices(): ShotVideoTakeInputModelChoiceReport[] {
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: true,
      mediaKind: 'image',
      defaultParameterValues: defaultShotInputParameterValues(
        'fal-ai/openai/gpt-image-2',
        'text-to-image'
      ),
      parameters: shotInputParameters('fal-ai/openai/gpt-image-2', 'text-to-image'),
    },
    {
      modelChoice: 'fal-ai/nano-banana-2',
      label: 'Nano Banana 2',
      available: true,
      mediaKind: 'image',
      defaultParameterValues: defaultShotInputParameterValues(
        'fal-ai/nano-banana-2',
        'text-to-image'
      ),
      parameters: shotInputParameters('fal-ai/nano-banana-2', 'text-to-image'),
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      label: 'Grok Imagine',
      available: true,
      mediaKind: 'image',
      defaultParameterValues: defaultShotInputParameterValues(
        'fal-ai/xai/grok-imagine-image',
        'text-to-image'
      ),
      parameters: shotInputParameters(
        'fal-ai/xai/grok-imagine-image',
        'text-to-image'
      ),
    },
  ];
}



export function shotInputParameters(
  modelChoice: ShotVideoTakeInputModelChoice,
  routeKind: ShotInputRouteKind
): ShotVideoTakeInputModelChoiceReport['parameters'] {
  if (modelChoice === 'fal-ai/openai/gpt-image-2') {
    return [
      {
        name: 'image_size',
        label: 'Image size',
        required: true,
        defaultValue: { width: 1024, height: 768 },
      },
      {
        name: 'quality',
        label: 'Quality',
        required: true,
        defaultValue: 'low',
        allowedValues: ['low', 'medium', 'high'],
      },
      {
        name: 'output_format',
        label: 'Output format',
        required: true,
        defaultValue: 'png',
        allowedValues: ['jpeg', 'png', 'webp'],
      },
    ];
  }
  if (modelChoice === 'fal-ai/nano-banana-2') {
    return [
      {
        name: 'aspect_ratio',
        label: 'Aspect ratio',
        required: true,
        defaultValue: '16:9',
        allowedValues: ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'],
      },
      {
        name: 'resolution',
        label: 'Resolution',
        required: true,
        defaultValue: '1K',
        allowedValues: ['1K', '2K', '4K'],
      },
      {
        name: 'output_format',
        label: 'Output format',
        required: true,
        defaultValue: 'png',
        allowedValues: ['jpeg', 'png', 'webp'],
      },
      {
        name: 'seed',
        label: 'Seed',
        required: false,
        defaultValue: null,
      },
    ];
  }
  if (routeKind === 'reference-to-image') {
    return [
      {
        name: 'output_format',
        label: 'Output format',
        required: true,
        defaultValue: 'png',
        allowedValues: ['jpeg', 'png', 'webp'],
      },
    ];
  }
  return [
    {
      name: 'aspect_ratio',
      label: 'Aspect ratio',
      required: true,
      defaultValue: '16:9',
      allowedValues: ['2:1', '20:9', '19.5:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:19.5', '9:20', '1:2'],
    },
    {
      name: 'resolution',
      label: 'Resolution',
      required: true,
      defaultValue: '1k',
      allowedValues: ['1k', '2k'],
    },
    {
      name: 'output_format',
      label: 'Output format',
      required: true,
      defaultValue: 'png',
      allowedValues: ['jpeg', 'png', 'webp'],
    },
  ];
}



export function modelReport(
  family: (typeof SHOT_VIDEO_MODEL_FAMILIES)[number],
  inputModeId: ShotVideoTakeInputModeId,
  shotGroupMode: ShotVideoTakeShotGroupMode
): ShotVideoTakeModelChoiceReport {
  const route = family.routes.find(
    (candidate) =>
      candidate.inputMode === inputModeId &&
      candidate.shotGroupMode === shotGroupMode
  );
  const supportedInputModes = [
    ...new Set(
      family.routes
        .filter((candidate) => candidate.shotGroupMode === shotGroupMode)
        .map((candidate) => candidate.inputMode)
    ),
  ];
  return {
    modelChoice: family.choice,
    label: modelFamilyLabel(family),
    available: Boolean(route),
    ...(!route ? { unavailableReason: `This model does not support ${inputModeId}.` } : {}),
    supportedInputModes,
    duration: route ? durationSupportForRoute(route) : { supported: false },
    inputRoles: route ? inputRolesForRoute(route.inputSlots) : [],
    parameters: route ? parametersForRoute(route) : [],
    estimateInputs: {
      canEstimateBeforeDependenciesExist:
        !route || route.inputSlots.filter((slot) => slot.required).length === 0,
      requiresPreparedInputs: Boolean(route?.inputSlots.some((slot) => slot.required)),
    },
  };
}



export function defaultModelChoiceForInputMode(inputModeId: ShotVideoTakeInputModeId): ShotVideoTakeModelChoice {
  if (inputModeId === 'first-last-frame') {
    return 'fal-ai/veo3.1';
  }
  if (inputModeId === 'text-only') {
    return 'fal-ai/bytedance/seedance-2.0';
  }
  return 'fal-ai/bytedance/seedance-2.0';
}
