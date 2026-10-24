const nonEmptyString = { type: 'string', minLength: 1, pattern: '\\S' } as const;
const idList = {
  type: 'array',
  uniqueItems: true,
  items: nonEmptyString,
} as const;
const textList = { type: 'array', items: nonEmptyString } as const;
const skillKey = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)*$',
} as const;

export const castingRouteSchema = {
  $id: 'https://schemas.gorenku.com/studio/casting-route.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['provider', 'model', 'count'],
  properties: {
    provider: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    model: {
      type: 'object',
      required: ['key', 'name'],
      properties: {
        key: skillKey,
        name: { type: 'string', minLength: 1, maxLength: 128 },
      },
      additionalProperties: false,
    },
    count: { type: 'integer', minimum: 1, maximum: 50 },
  },
  additionalProperties: false,
} as const;

const castingRoutes = {
  type: 'array',
  items: { $ref: castingRouteSchema.$id },
} as const;

const estimatedCost = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      required: ['amount', 'currency'],
      properties: {
        amount: { type: 'number', minimum: 0 },
        currency: { type: 'string', pattern: '^[A-Z]{3}$' },
      },
      additionalProperties: false,
    },
  ],
} as const;

export const castLooksPlanDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/cast-looks-plan.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'castMemberId', 'looks'],
  properties: {
    kind: { const: 'castLooksPlan' },
    castMemberId: nonEmptyString,
    looks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'sceneIds'],
        properties: {
          id: nonEmptyString,
          name: { ...nonEmptyString, maxLength: 80 },
          description: nonEmptyString,
          sceneIds: idList,
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const castWardrobePlanDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/cast-wardrobe-plan.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'castMemberId', 'costumes'],
  properties: {
    kind: { const: 'castWardrobePlan' },
    castMemberId: nonEmptyString,
    costumes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'lookId', 'wardrobe', 'continuityNotes', 'sceneIds'],
        properties: {
          id: nonEmptyString,
          name: { ...nonEmptyString, maxLength: 80 },
          lookId: nonEmptyString,
          wardrobe: { ...textList, minItems: 1 },
          continuityNotes: textList,
          sceneIds: idList,
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const castingRoundCreateDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/casting-round-create.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'lookId', 'routes', 'maxConcurrentGenerations', 'referenceAssetFileIds', 'estimatedCost'],
  properties: {
    kind: { const: 'castingRoundCreate' },
    lookId: nonEmptyString,
    routes: { ...castingRoutes, minItems: 1 },
    maxConcurrentGenerations: { type: 'integer', minimum: 1, maximum: 5 },
    referenceAssetFileIds: idList,
    estimatedCost,
  },
  additionalProperties: false,
} as const;

export const castingSettingsSchema = {
  $id: 'https://schemas.gorenku.com/studio/casting-settings.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['routes'],
  properties: {
    routes: castingRoutes,
  },
  additionalProperties: false,
} as const;

/** Stored JSON columns of `casting_round` and `cast_costume`. */
export const storedCastingRoutesSchema = {
  $id: 'https://schemas.gorenku.com/studio/stored-casting-routes.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...castingRoutes,
  minItems: 1,
} as const;

export const storedCastingEstimatedCostSchema = {
  $id: 'https://schemas.gorenku.com/studio/stored-casting-estimated-cost.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...estimatedCost,
} as const;

export const storedCastingIdListSchema = {
  $id: 'https://schemas.gorenku.com/studio/stored-casting-id-list.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...idList,
} as const;

export const storedCastingTextListSchema = {
  $id: 'https://schemas.gorenku.com/studio/stored-casting-text-list.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...textList,
} as const;
