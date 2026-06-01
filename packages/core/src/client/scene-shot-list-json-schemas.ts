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
    lookbookInfluence: nonEmptyString(),
    shots: {
      type: 'array',
      minItems: 1,
      items: objectWith(
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
      ),
    },
    openQuestions: {
      type: 'array',
      items: nonEmptyString(),
    },
  },
  additionalProperties: false,
} as const;

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
          usesDifferentLocation: { type: 'boolean' },
          azimuthView: enumValue(LOCATION_AZIMUTH_VIEW_IDS),
          customView: nonEmptyString(),
        },
        additionalProperties: false,
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

function nonNegativeInteger(): Record<string, unknown> {
  return { type: 'integer', minimum: 0 };
}
