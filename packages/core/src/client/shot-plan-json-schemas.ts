import {
  CAMERA_ANGLE_LABELS,
  MOVEMENT_LABELS,
  SHOT_DEPTH_OF_FIELD_LABELS,
  SHOT_SIZE_LABELS,
} from './shot-spec-labels.js';

const nonEmptyString = {
  type: 'string',
  minLength: 1,
  pattern: '\\S',
} as const;

const optionalTextFields = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  additionalProperties: false,
});

const catalogOrCustom = (values: readonly string[]) => ({
  anyOf: [
    { enum: values },
    {
      allOf: [
        nonEmptyString,
        { not: { enum: values } },
      ],
    },
  ],
});

const shotSizeValues = Object.keys(SHOT_SIZE_LABELS);
const cameraAngleValues = Object.keys(CAMERA_ANGLE_LABELS);
const movementValues = Object.keys(MOVEMENT_LABELS);
const shotDepthOfFieldValues = Object.keys(SHOT_DEPTH_OF_FIELD_LABELS);

export const shotPlanCoverageSchema = {
  $id: 'https://schemas.gorenku.com/studio/shot-plan-coverage.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['beatSheetId', 'beatIds'],
  properties: {
    beatSheetId: nonEmptyString,
    beatIds: {
      type: 'array',
      items: nonEmptyString,
    },
  },
  additionalProperties: false,
} as const;

export const shotBriefSchema = {
  $id: 'https://schemas.gorenku.com/studio/shot-brief.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    durationSeconds: {
      type: 'number',
      exclusiveMinimum: 0,
    },
    framing: optionalTextFields({
      start: catalogOrCustom(shotSizeValues),
      end: catalogOrCustom(shotSizeValues),
    }),
    camera: optionalTextFields({
      angle: catalogOrCustom(cameraAngleValues),
    }),
    motion: optionalTextFields({
      movement: catalogOrCustom(movementValues),
    }),
    optics: optionalTextFields({
      intent: nonEmptyString,
      focalLengthMm: {
        type: 'number',
        exclusiveMinimum: 0,
      },
      depthOfField: { enum: shotDepthOfFieldValues },
      focusTarget: nonEmptyString,
    }),
    lighting: optionalTextFields({
      intent: nonEmptyString,
    }),
  },
  additionalProperties: false,
} as const;

const shotInputProperties = {
  title: nonEmptyString,
  description: { type: 'string' },
  brief: shotBriefSchema,
} as const;

export const shotPlanCreateDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/shot-plan-create.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'sceneId', 'title', 'coverage', 'shots'],
  properties: {
    kind: { const: 'shotPlanCreate' },
    sceneId: nonEmptyString,
    title: nonEmptyString,
    coverage: {
      anyOf: [shotPlanCoverageSchema, { type: 'null' }],
    },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'description', 'brief'],
        properties: shotInputProperties,
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const shotPlanUpdateDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/shot-plan-update.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'title', 'coverage'],
  properties: {
    kind: { const: 'shotPlanUpdate' },
    title: nonEmptyString,
    coverage: {
      anyOf: [shotPlanCoverageSchema, { type: 'null' }],
    },
  },
  additionalProperties: false,
} as const;

export const shotDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/shot.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'title', 'description', 'brief'],
  properties: {
    kind: { const: 'shot' },
    ...shotInputProperties,
  },
  additionalProperties: false,
} as const;
