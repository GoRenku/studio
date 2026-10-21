const nonEmptyString = { type: 'string', minLength: 1, pattern: '\\S' } as const;
const sceneIds = {
  type: 'array',
  minItems: 1,
  uniqueItems: true,
  items: nonEmptyString,
} as const;
const spineField = {
  type: 'object',
  required: ['text', 'sceneIds'],
  properties: {
    text: nonEmptyString,
    sceneIds,
  },
  additionalProperties: false,
} as const;

const characterArcSchemaDefinition = {
  type: 'object',
  required: ['kind', 'arcType', 'startState', 'endState', 'ends', 'spine', 'turningPoints'],
  properties: {
    kind: { const: 'characterArc' },
    arcType: { enum: ['positiveChange', 'flat', 'disillusionment', 'fall', 'corruption'] },
    startState: nonEmptyString,
    endState: nonEmptyString,
    ends: {
      type: 'object',
      required: ['high', 'low'],
      properties: { high: nonEmptyString, low: nonEmptyString },
      additionalProperties: false,
    },
    spine: {
      type: 'object',
      required: ['want'],
      properties: {
        want: spineField,
        need: spineField,
        falseBelief: spineField,
        wound: spineField,
        truthHeld: spineField,
        testedBy: spineField,
        changesOthers: spineField,
      },
      additionalProperties: false,
    },
    turningPoints: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['sceneIds', 'label', 'state', 'position'],
        properties: {
          sceneIds,
          label: nonEmptyString,
          state: nonEmptyString,
          position: { type: 'integer', minimum: -5, maximum: 5 },
          quote: nonEmptyString,
          lookAssetFileId: nonEmptyString,
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

const characterArcReferenceSchemaDefinition = {
  type: 'object',
  required: ['kind', 'castMemberId'],
  properties: {
    kind: { const: 'characterArcReference' },
    castMemberId: nonEmptyString,
  },
  additionalProperties: false,
} as const;

export const characterArcDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/character-arc.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind'],
  properties: {
    kind: { enum: ['characterArc', 'characterArcReference'] },
  },
  allOf: [
    { if: { type: 'object', properties: { kind: { const: 'characterArc' } } }, then: characterArcSchemaDefinition },
    { if: { type: 'object', properties: { kind: { const: 'characterArcReference' } } }, then: characterArcReferenceSchemaDefinition },
  ],
} as const;

export const characterArcsWriteDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/character-arcs-write.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'arcs'],
  properties: {
    kind: { const: 'characterArcs' },
    arcs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['castMemberId', 'arc'],
        properties: {
          castMemberId: nonEmptyString,
          arc: { $ref: 'https://schemas.gorenku.com/studio/character-arc.schema.json' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

/** Stored envelope in `cast_member.character_arc`. */
export const storedCharacterArcSchema = {
  $id: 'https://schemas.gorenku.com/studio/stored-character-arc.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['writtenAt', 'arc'],
  properties: {
    writtenAt: nonEmptyString,
    arc: { $ref: 'https://schemas.gorenku.com/studio/character-arc.schema.json' },
  },
  additionalProperties: false,
} as const;
