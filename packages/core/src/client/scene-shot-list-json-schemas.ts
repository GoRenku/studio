// Controlled vocabularies for the structured shot specs selections (0036).
// Declared before the schema literal below so they are initialised when the
// literal evaluates. Keep aligned with the id unions in `scene-shot-list.ts`.
const SHOT_SIZE_IDS = [
  'extreme-close-up',
  'close-up',
  'medium-close-up',
  'medium-shot',
  'medium-full-shot',
  'full-shot',
  'wide-shot',
  'extreme-wide-shot',
  'establishing-shot',
] as const;

const SUBJECT_FRAMING_IDS = [
  'single',
  'two-shot',
  'three-shot',
  'group',
  'over-the-shoulder',
  'over-the-hip',
  'point-of-view',
  'insert',
  'reaction',
] as const;

const CAMERA_ANGLE_IDS = [
  'ground-level',
  'knee-level',
  'hip-level',
  'shoulder-level',
  'eye-level',
  'low-angle',
  'high-angle',
  'overhead',
] as const;

const MOVEMENT_IDS = [
  'static',
  'pan',
  'tilt',
  'swish-pan',
  'swish-tilt',
  'tracking',
  'push-in',
  'pull-out',
  'zoom',
  'rack-focus',
] as const;

const MOVE_DIRECTION_IDS = [
  'forward',
  'backward',
  'left',
  'right',
  'up',
  'down',
] as const;

const LENS_IDS = [
  'ultra-wide',
  'wide',
  'normal',
  'short-tele',
  'tele',
  'macro',
] as const;

const FOCUS_IDS = [
  'deep-focus',
  'shallow-focus',
  'rack-focus',
  'tilt-shift',
] as const;

const LOCATION_AZIMUTH_VIEW_IDS = [
  'front',
  'right',
  'back',
  'left',
] as const;

const SHOT_VIDEO_TAKE_INPUT_MODE_IDS = [
  'text-only',
  'first-frame',
  'first-last-frame',
  'reference',
] as const;

const SHOT_VIDEO_TAKE_INPUT_KINDS = [
  'first-frame',
  'last-frame',
  'reference-image',
  'character-sheet',
  'location-sheet',
  'lookbook-sheet',
  'multi-shot-storyboard-sheet',
  'source-video',
  'audio',
] as const;

const SHOT_VIDEO_TAKE_INPUT_SUBJECT_KINDS = [
  'asset',
  'cast-member',
  'location',
  'lookbook',
  'production-group',
  'scene-dialogue',
  'shot',
] as const;

const SHOT_VIDEO_TAKE_DEPENDENCY_KINDS = [
  'first-frame',
  'last-frame',
  'reference-image',
  'lookbook-sheet',
  'multi-shot-storyboard-sheet',
  'reference-audio',
  'source-video-extract',
] as const;

const SHOT_VIDEO_TAKE_INPUT_PURPOSES = [
  'shot.first-frame',
  'shot.last-frame',
  'shot.reference-image',
  'shot.multi-shot-storyboard-sheet',
] as const;

const SHOT_VIDEO_TAKE_INPUT_MODELS = [
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
] as const;

const SHOT_VIDEO_TAKE_MODELS = [
  'fal-ai/bytedance/seedance-2.0',
  'fal-ai/kling-video/v3/pro',
  'fal-ai/veo3.1',
  'fal-ai/xai/grok-imagine-video-1.5',
  'fal-ai/ltx-3.2',
  'fal-ai/alibaba/happy-horse',
] as const;

export const sceneShotListDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-shot-list-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [
    'kind',
    'sceneId',
    'title',
    'summary',
    'coverageStrategy',
    'shots',
  ],
  properties: {
    kind: { const: 'sceneShotList' },
    sceneId: nonEmptyString(),
    title: nonEmptyString(),
    summary: nonEmptyString(),
    coverageStrategy: nonEmptyString(),
    baseShotListId: {
      anyOf: [nonEmptyString(), { type: 'null' }],
    },
    lookbookInfluence: nonEmptyString(),
    shots: sceneShotArraySchema({ minItems: 1 }),
    videoTakeRailGroups: {
      type: 'array',
      items: objectWith(['productionGroupId', 'shotIds'], {
        productionGroupId: nonEmptyString(),
        shotIds: {
          type: 'array',
          minItems: 1,
          items: nonEmptyString(),
        },
      }),
    },
    videoTakeProductionGroups: {
      type: 'array',
      items: objectWith(['productionGroupId', 'shotIds', 'videoTakeProduction'], {
        productionGroupId: nonEmptyString(),
        shotIds: {
          type: 'array',
          minItems: 1,
          items: nonEmptyString(),
        },
        videoTakeProduction: shotVideoTakeProductionPlanSchema(),
      }),
    },
    openQuestions: {
      type: 'array',
      items: nonEmptyString(),
    },
  },
  additionalProperties: false,
} as const;

export const sceneShotListOperationDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-shot-list-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'sceneId', 'baseShotListId', 'activate', 'operations'],
  properties: {
    kind: { const: 'sceneShotListOperations' },
    sceneId: nonEmptyString(),
    baseShotListId: nonEmptyString(),
    activate: { type: 'boolean' },
    title: nonEmptyString(),
    summary: nonEmptyString(),
    coverageStrategy: nonEmptyString(),
    lookbookInfluence: nonEmptyString(),
    operations: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          objectWith(['operation', 'placement', 'shots'], {
            operation: { const: 'shots.insert' },
            placement: {
              oneOf: [
                objectWith(['position'], { position: { const: 'start' } }),
                objectWith(['position'], { position: { const: 'end' } }),
                objectWith(['position', 'shotId'], {
                  position: { const: 'before' },
                  shotId: nonEmptyString(),
                }),
                objectWith(['position', 'shotId'], {
                  position: { const: 'after' },
                  shotId: nonEmptyString(),
                }),
              ],
            },
            shots: sceneShotArraySchema({ minItems: 1 }),
            storyboardPolicy: storyboardPolicySchema(),
          }),
          objectWith(['operation', 'shotIds', 'shots'], {
            operation: { const: 'shots.replace' },
            shotIds: nonEmptyStringArraySchema({ minItems: 1 }),
            shots: sceneShotArraySchema({ minItems: 1 }),
            storyboardPolicy: storyboardPolicySchema(),
          }),
          objectWith(['operation', 'shot'], {
            operation: { const: 'shot.update' },
            shot: sceneShotSchema(),
            storyboardPolicy: storyboardPolicySchema(),
          }),
          objectWith(['operation', 'shotIds'], {
            operation: { const: 'shots.delete' },
            shotIds: nonEmptyStringArraySchema({ minItems: 1 }),
          }),
          objectWith(['operation', 'shots'], {
            operation: { const: 'shotList.replace' },
            shots: sceneShotArraySchema({ minItems: 1 }),
            storyboardPolicy: storyboardPolicySchema(),
          }),
        ],
      },
    },
    openQuestions: nonEmptyStringArraySchema(),
  },
  additionalProperties: false,
} as const;

export const sceneStoryboardImagesImportDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-storyboard-images-import.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'shotListId', 'shots'],
  properties: {
    kind: { const: 'sceneStoryboardImagesImport' },
    title: nonEmptyString(),
    shotListId: nonEmptyString(),
    shots: {
      type: 'array',
      minItems: 1,
      items: objectWith(['shotId', 'source'], {
        shotId: nonEmptyString(),
        source: nonEmptyString(),
        title: nonEmptyString(),
        sourcePurpose: { const: 'scene.storyboard-sheet' },
        sourceSpecId: nonEmptyString(),
        sourceRunId: nonEmptyString(),
      }),
    },
  },
  additionalProperties: false,
} as const;

function sceneShotSchema(): Record<string, unknown> {
  return objectWith(
    [
      'shotId',
      'title',
      'storyBeat',
      'narrativePurpose',
      'description',
      'shotType',
      'subject',
      'action',
      'dialogue',
      'coveredBlockIndexes',
      'castMemberIds',
      'locationIds',
    ],
    {
      shotId: nonEmptyString(),
      title: nonEmptyString(),
      storyBeat: nonEmptyString(),
      narrativePurpose: nonEmptyString(),
      description: nonEmptyString(),
      shotType: nonEmptyString(),
      cameraAngle: nonEmptyString(),
      cameraMovement: nonEmptyString(),
      framing: nonEmptyString(),
      lensIntent: nonEmptyString(),
      aspectRatio: nonEmptyString(),
      subject: nonEmptyString(),
      action: nonEmptyString(),
      dialogue: {
        type: 'array',
        items: objectWith(['blockIndex', 'purpose'], {
          blockIndex: nonNegativeInteger(),
          lineIndexes: {
            type: 'array',
            minItems: 1,
            items: nonNegativeInteger(),
          },
          castMemberId: nonEmptyString(),
          purpose: nonEmptyString(),
        }),
      },
      coveredBlockIndexes: {
        type: 'array',
        items: nonNegativeInteger(),
      },
      castMemberIds: {
        type: 'array',
        items: nonEmptyString(),
      },
      locationIds: {
        type: 'array',
        items: nonEmptyString(),
      },
      audioNotes: nonEmptyString(),
      productionNotes: nonEmptyString(),
      shotSpecs: shotSpecsSchema(),
    }
  );
}

function sceneShotArraySchema(input: { minItems?: number } = {}): Record<string, unknown> {
  return {
    type: 'array',
    ...(input.minItems !== undefined ? { minItems: input.minItems } : {}),
    items: sceneShotSchema(),
  };
}

function storyboardPolicySchema(): Record<string, unknown> {
  return enumValue([
    'generate',
    'reuse-if-unchanged',
    'missing-only',
  ] as const);
}

function shotSpecsSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      shotSize: enumValue(SHOT_SIZE_IDS),
      subjectFraming: {
        type: 'array',
        items: enumValue(SUBJECT_FRAMING_IDS),
      },
      cameraAngle: enumValue(CAMERA_ANGLE_IDS),
      dutch: enumValue(['left', 'right'] as const),
      movement: {
        type: 'object',
        properties: {
          movement: enumValue(MOVEMENT_IDS),
          secondary: enumValue(MOVEMENT_IDS),
          directions: {
            type: 'array',
            items: enumValue(MOVE_DIRECTION_IDS),
          },
          track: enumValue(['straight', 'circular'] as const),
          rig: enumValue([
            'sticks',
            'hand-held',
            'gimbal',
            'slider',
            'jib',
            'drone',
            'dolly',
            'steadicam',
            'crane',
          ] as const),
        },
        additionalProperties: false,
      },
      lens: {
        type: 'object',
        properties: {
          type: enumValue(LENS_IDS),
          millimeters: { type: 'number', exclusiveMinimum: 0 },
          focus: enumValue(FOCUS_IDS),
        },
        additionalProperties: false,
      },
      location: {
        type: 'object',
        properties: {
          locationId: nonEmptyString(),
          environmentSheetAssetId: nonEmptyString(),
          viewIds: {
            type: 'array',
            items: enumValue(LOCATION_AZIMUTH_VIEW_IDS),
          },
        },
        additionalProperties: false,
      },
      castReferences: {
        type: 'object',
        properties: {
          castMemberIds: {
            type: 'array',
            items: nonEmptyString(),
          },
          characterSheetAssetIds: {
            type: 'object',
            additionalProperties: nonEmptyString(),
          },
        },
        additionalProperties: false,
      },
      lookbookReference: {
        type: 'object',
        properties: {
          lookbookSheetId: nonEmptyString(),
        },
        additionalProperties: false,
      },
      referenceImages: {
        type: 'object',
        properties: {
          customReferenceInputIds: {
            type: 'array',
            items: nonEmptyString(),
          },
        },
        additionalProperties: false,
      },
      referenceInclusions: {
        type: 'object',
        additionalProperties: enumValue(['include', 'exclude'] as const),
      },
      custom: {
        type: 'object',
        properties: {
          composition: nonEmptyString(),
          movement: nonEmptyString(),
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  };
}

function shotVideoTakeProductionPlanSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      inputModeId: enumValue(SHOT_VIDEO_TAKE_INPUT_MODE_IDS),
      modelChoice: enumValue(SHOT_VIDEO_TAKE_MODELS),
      parameterValues: shotVideoTakeParameterValuesSchema(),
      requestedInputs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: enumValue(SHOT_VIDEO_TAKE_INPUT_KINDS),
            subjectKind: enumValue(SHOT_VIDEO_TAKE_INPUT_SUBJECT_KINDS),
            subjectId: nonEmptyString(),
            fulfillmentMode: enumValue(['reuse-existing', 'generate-new'] as const),
            note: nonEmptyString(),
          },
          required: ['kind'],
          additionalProperties: false,
        },
      },
      preparedInputs: {
        type: 'array',
        items: objectWith(['kind', 'assetId', 'subjectKind', 'subjectId'], {
          kind: enumValue(SHOT_VIDEO_TAKE_INPUT_KINDS),
          assetId: nonEmptyString(),
          assetFileId: nonEmptyString(),
          subjectKind: enumValue(SHOT_VIDEO_TAKE_INPUT_SUBJECT_KINDS),
          subjectId: nonEmptyString(),
        }),
      },
      agentProposal: {
        type: 'object',
        required: ['basedOnInputModeId', 'basedOnModelChoice', 'dependencyDrafts'],
        properties: {
          basedOnInputModeId: enumValue(SHOT_VIDEO_TAKE_INPUT_MODE_IDS),
          basedOnModelChoice: enumValue(SHOT_VIDEO_TAKE_MODELS),
          basedOnShotIds: {
            type: 'array',
            minItems: 1,
            items: nonEmptyString(),
          },
          dependencyDrafts: {
            type: 'array',
            items: objectWith(
              ['purpose', 'dependencyKind', 'outputInputKind', 'prompt'],
              {
                purpose: enumValue(SHOT_VIDEO_TAKE_INPUT_PURPOSES),
                dependencyKind: enumValue(SHOT_VIDEO_TAKE_DEPENDENCY_KINDS),
                outputInputKind: enumValue(SHOT_VIDEO_TAKE_INPUT_KINDS),
                modelChoice: enumValue(SHOT_VIDEO_TAKE_INPUT_MODELS),
                prompt: nonEmptyString(),
                parameterValues: shotVideoTakeParameterValuesSchema(),
                title: nonEmptyString(),
              }
            ),
          },
          finalPromptDraft: objectWith(['prompt'], {
            prompt: nonEmptyString(),
            negativePrompt: nonEmptyString(),
            title: nonEmptyString(),
          }),
        },
        additionalProperties: false,
      },
      customPromptNote: nonEmptyString(),
    },
    additionalProperties: false,
  };
}

function shotVideoTakeParameterValuesSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: {
      anyOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
        { type: 'array', items: { type: 'string' } },
        { type: 'array', items: { type: 'number' } },
        { type: 'array', items: { type: 'boolean' } },
      ],
    },
  };
}

function enumValue(values: readonly string[]): Record<string, unknown> {
  return { type: 'string', enum: [...values] };
}

function objectWith(
  required: string[],
  properties: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  };
}

function nonEmptyString(): Record<string, unknown> {
  return { type: 'string', minLength: 1 };
}

function nonEmptyStringArraySchema(
  input: { minItems?: number } = {}
): Record<string, unknown> {
  return {
    type: 'array',
    ...(input.minItems !== undefined ? { minItems: input.minItems } : {}),
    items: nonEmptyString(),
  };
}

function nonNegativeInteger(): Record<string, unknown> {
  return { type: 'integer', minimum: 0 };
}
