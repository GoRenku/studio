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
      start: nonEmptyString,
      end: nonEmptyString,
    }),
    camera: optionalTextFields({
      angle: nonEmptyString,
      movement: nonEmptyString,
    }),
    optics: optionalTextFields({
      focalLengthMm: {
        type: 'number',
        exclusiveMinimum: 0,
      },
      depthOfField: nonEmptyString,
      focusTarget: nonEmptyString,
    }),
    lighting: optionalTextFields({
      key: nonEmptyString,
      accent: nonEmptyString,
    }),
  },
  additionalProperties: false,
} as const;
