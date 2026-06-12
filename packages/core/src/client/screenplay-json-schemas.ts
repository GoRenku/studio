export const screenplayReferenceSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-reference.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  oneOf: [
    {
      required: ['id'],
      properties: {
        id: { type: 'string', minLength: 1 },
        key: { type: 'string', minLength: 1 },
      },
      not: {
        type: 'object',
        properties: { key: true },
        required: ['key'],
      },
      additionalProperties: true,
    },
    {
      required: ['key'],
      properties: {
        id: { type: 'string', minLength: 1 },
        key: { type: 'string', minLength: 1 },
      },
      not: {
        type: 'object',
        properties: { id: true },
        required: ['id'],
      },
      additionalProperties: true,
    },
  ],
} as const;

export const screenplayBlockSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-block.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    {
      type: 'object',
      required: ['type', 'text'],
      properties: {
        type: {
          enum: [
            'action',
            'parenthetical',
            'transition',
            'special_heading',
            'title_card',
            'super',
            'shot',
            'note',
          ],
        },
        text: { type: 'string' },
        render: { type: 'boolean' },
        castMemberReferences: refArray(),
        locationReferences: refArray(),
        castMemberIds: stringIdArray(),
        locationIds: stringIdArray(),
      },
      additionalProperties: true,
    },
    {
      type: 'object',
      required: ['type', 'lines'],
      anyOf: [{ required: ['castMemberReference'] }, { required: ['castMemberId'] }],
      properties: {
        dialogueId: stringId(),
        type: { const: 'dialogue' },
        castMemberReference: ref(),
        castMemberId: stringId(),
        extension: { type: 'string' },
        parenthetical: { type: 'string' },
        lines: { type: 'array', items: { type: 'string' } },
        castMemberReferences: refArray(),
        locationReferences: refArray(),
        castMemberIds: stringIdArray(),
        locationIds: stringIdArray(),
      },
      additionalProperties: true,
    },
  ],
} as const;

export const screenplayBlockArraySchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-block-array.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'array',
  items: {
    $ref: 'https://schemas.gorenku.com/studio/screenplay-block.schema.json',
  },
} as const;

export const screenplayStringArraySchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-string-array.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'array',
  items: { type: 'string' },
} as const;

export const screenplayDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'screenplay', 'cast', 'locations', 'acts'],
  properties: {
    kind: { const: 'screenplay' },
    screenplay: { $ref: '#/$defs/screenplay' },
    cast: { type: 'array', items: { $ref: '#/$defs/castMember' } },
    locations: { type: 'array', items: { $ref: '#/$defs/location' } },
    acts: { type: 'array', items: { $ref: '#/$defs/act' } },
  },
  additionalProperties: true,
  $defs: {
    screenplay: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        intendedAudience: { type: 'string' },
        targetLengthLabel: { type: 'string' },
        estimatedMinutes: { type: 'integer', minimum: 1 },
        genrePrimary: { type: 'string' },
        genreSecondary: stringArray(),
        tone: stringArray(),
        ratingIntent: { type: 'string' },
        boundaries: stringArray(),
        logline: { type: 'string' },
        summary: { type: 'string' },
        premiseOverview: { type: 'string' },
        centralConflict: { type: 'string' },
        dramaticQuestion: { type: 'string' },
        themes: stringArray(),
        historicalBasis: stringArray(),
        dramatizedElements: stringArray(),
        status: { type: 'string' },
        researchSources: stringArray(),
        assumptionsMade: stringArray(),
      },
      additionalProperties: true,
    },
    castMember: objectWith(['handle', 'name'], {
      id: stringId(),
      key: stringId(),
      handle: handle(),
      name: { type: 'string' },
      isVoiceOver: { type: 'boolean' },
      role: { type: 'string' },
      age: { type: 'integer', minimum: 0 },
      want: { type: 'string' },
      need: { type: 'string' },
      arc: { type: 'string' },
      voiceNotes: { type: 'string' },
      description: { type: 'string' },
    }),
    location: objectWith(['handle', 'name'], {
      id: stringId(),
      key: stringId(),
      handle: handle(),
      name: { type: 'string' },
      timePeriod: { type: 'string' },
      description: { type: 'string' },
      visualNotes: { type: 'string' },
    }),
    act: objectWith(['sequences'], {
      id: stringId(),
      key: stringId(),
      title: { type: 'string' },
      purpose: { type: 'string' },
      sequences: { type: 'array', items: { $ref: '#/$defs/sequence' } },
    }),
    sequence: objectWith(['scenes'], {
      id: stringId(),
      key: stringId(),
      title: { type: 'string' },
      purpose: { type: 'string' },
      scenes: { type: 'array', items: { $ref: '#/$defs/scene' } },
    }),
    scene: objectWith(['title', 'setting', 'blocks'], {
      id: stringId(),
      key: stringId(),
      title: { type: 'string' },
      setting: { $ref: '#/$defs/sceneSetting' },
      storyFunction: stringArray(),
      blocks: {
        type: 'array',
        items: {
          $ref: 'https://schemas.gorenku.com/studio/screenplay-block.schema.json',
        },
      },
    }),
    sceneSetting: objectWith([], {
      interiorExterior: { type: 'string' },
      timeOfDay: { type: 'string' },
      locationReferences: refArray(),
      locationIds: { type: 'array', items: stringId() },
    }),
  },
} as const;

export const screenplayCreateDocumentSchema = {
  ...screenplayDocumentSchema,
  $id: 'https://schemas.gorenku.com/studio/screenplay-create-document.schema.json',
  properties: {
    ...screenplayDocumentSchema.properties,
    kind: { const: 'screenplayCreate' },
  },
} as const;

const entityDefs = {
  act: { field: 'act', id: 'actId', parent: null },
  sequence: { field: 'sequence', id: 'sequenceId', parent: 'actId' },
  scene: { field: 'scene', id: 'sceneId', parent: 'sequenceId' },
} as const;

export const screenplayOperationsSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'operations'],
  properties: {
    kind: { const: 'screenplayOperations' },
    operations: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/$defs/screenplayUpdate' },
          ...Object.keys(entityDefs).flatMap((name) => [
            { $ref: `#/$defs/${name}Add` },
            { $ref: `#/$defs/${name}Update` },
            { $ref: `#/$defs/${name}Delete` },
            { $ref: `#/$defs/${name}Move` },
          ]),
        ],
      },
    },
  },
  additionalProperties: true,
  $defs: {
    placement: {
      type: 'object',
      anyOf: [
        { required: ['beforeId'] },
        { required: ['afterId'] },
        { required: ['position'] },
      ],
      properties: {
        beforeId: stringId(),
        afterId: stringId(),
        position: { const: 'only' },
      },
      allOf: [
        {
          if: { required: ['position'] },
          then: {
            not: {
              anyOf: [{ required: ['beforeId'] }, { required: ['afterId'] }],
            },
          },
        },
      ],
      additionalProperties: true,
    },
    screenplayUpdate: operationObject(['operation', 'screenplay'], {
      operation: { const: 'screenplay.update' },
      screenplay: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/screenplay' },
    }),
    actAdd: operationObject(['operation', 'act'], {
      operation: { const: 'act.add' },
      placement: { $ref: '#/$defs/placement' },
      act: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/act' },
    }),
    actUpdate: operationObject(['operation', 'act'], {
      operation: { const: 'act.update' },
      act: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/act' },
    }),
    actDelete: operationObject(['operation', 'actId'], {
      operation: { const: 'act.delete' },
      actId: stringId(),
    }),
    actMove: operationObject(['operation', 'actId', 'placement'], {
      operation: { const: 'act.move' },
      actId: stringId(),
      placement: { $ref: '#/$defs/placement' },
    }),
    sequenceAdd: operationObject(['operation', 'actId', 'sequence'], {
      operation: { const: 'sequence.add' },
      actId: stringId(),
      placement: { $ref: '#/$defs/placement' },
      sequence: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/sequence' },
    }),
    sequenceUpdate: operationObject(['operation', 'sequence'], {
      operation: { const: 'sequence.update' },
      sequence: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/sequence' },
    }),
    sequenceDelete: operationObject(['operation', 'sequenceId'], {
      operation: { const: 'sequence.delete' },
      sequenceId: stringId(),
    }),
    sequenceMove: operationObject(['operation', 'sequenceId', 'fromActId', 'toActId', 'placement'], {
      operation: { const: 'sequence.move' },
      sequenceId: stringId(),
      fromActId: stringId(),
      toActId: stringId(),
      placement: { $ref: '#/$defs/placement' },
    }),
    sceneAdd: operationObject(['operation', 'sequenceId', 'scene'], {
      operation: { const: 'scene.add' },
      sequenceId: stringId(),
      placement: { $ref: '#/$defs/placement' },
      scene: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/scene' },
    }),
    sceneUpdate: operationObject(['operation', 'scene'], {
      operation: { const: 'scene.update' },
      scene: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/scene' },
    }),
    sceneDelete: operationObject(['operation', 'sceneId'], {
      operation: { const: 'scene.delete' },
      sceneId: stringId(),
    }),
    sceneMove: operationObject(['operation', 'sceneId', 'fromSequenceId', 'toSequenceId', 'placement'], {
      operation: { const: 'scene.move' },
      sceneId: stringId(),
      fromSequenceId: stringId(),
      toSequenceId: stringId(),
      placement: { $ref: '#/$defs/placement' },
    }),
  },
} as const;

export const screenplaySceneRevisionDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-scene-revision.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'scene'],
  properties: {
    kind: { const: 'screenplaySceneRevision' },
    scene: {
      $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/scene',
    },
  },
  additionalProperties: false,
} as const;

function ref() {
  return {
    $ref: 'https://schemas.gorenku.com/studio/screenplay-reference.schema.json',
  };
}

function refArray() {
  return { type: 'array', items: ref() };
}

function stringArray() {
  return { $ref: 'https://schemas.gorenku.com/studio/screenplay-string-array.schema.json' };
}

function stringIdArray() {
  return { type: 'array', items: stringId() };
}

function stringId() {
  return { type: 'string', minLength: 1 };
}

function handle() {
  return { type: 'string', pattern: '^[a-z][a-z0-9-]*$' };
}

function objectWith(required: string[], properties: Record<string, unknown>) {
  return { type: 'object', required, properties, additionalProperties: true };
}

function operationObject(required: string[], properties: Record<string, unknown>) {
  return objectWith(required, properties);
}
