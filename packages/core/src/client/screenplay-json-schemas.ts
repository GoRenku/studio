export const screenplayReferenceSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-reference.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  oneOf: [
    {
      required: ['id'],
      properties: {
        id: { type: 'string', minLength: 1 },
        localKey: { type: 'string', minLength: 1 },
      },
      not: {
        type: 'object',
        properties: { localKey: true },
        required: ['localKey'],
      },
      additionalProperties: true,
    },
    {
      required: ['localKey'],
      properties: {
        id: { type: 'string', minLength: 1 },
        localKey: { type: 'string', minLength: 1 },
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
        id: { type: 'string', minLength: 1 },
        localKey: { type: 'string', minLength: 1 },
        type: { const: 'action' },
        text: { type: 'string' },
        castMemberRefs: refArray(),
        locationRefs: refArray(),
      },
      additionalProperties: true,
    },
    {
      type: 'object',
      required: ['type', 'castMemberRef', 'lines'],
      properties: {
        id: { type: 'string', minLength: 1 },
        localKey: { type: 'string', minLength: 1 },
        type: { const: 'dialogue' },
        castMemberRef: ref(),
        extension: { type: 'string' },
        parenthetical: { type: 'string' },
        lines: { type: 'array', items: { type: 'string' } },
        castMemberRefs: refArray(),
        locationRefs: refArray(),
      },
      additionalProperties: true,
    },
  ],
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
        genreSecondary: { type: 'array', items: { type: 'string' } },
        tone: { type: 'array', items: { type: 'string' } },
        ratingIntent: { type: 'string' },
        boundaries: { type: 'array', items: { type: 'string' } },
        logline: { type: 'string' },
        summary: { type: 'string' },
        premiseOverview: { type: 'string' },
        centralConflict: { type: 'string' },
        dramaticQuestion: { type: 'string' },
        themes: { type: 'array', items: { type: 'string' } },
        historicalBasis: { type: 'array' },
        dramatizedElements: { type: 'array' },
        structureModel: { type: 'string' },
        status: { type: 'string' },
        researchSources: { type: 'array' },
        assumptionsMade: { type: 'array' },
      },
      additionalProperties: true,
    },
    castMember: objectWith(['name'], {
      id: stringId(),
      localKey: stringId(),
      name: { type: 'string' },
      role: { type: 'string' },
      age: { type: 'integer', minimum: 0 },
      want: { type: 'string' },
      need: { type: 'string' },
      arc: { type: 'string' },
      voiceNotes: { type: 'string' },
      description: { type: 'string' },
    }),
    location: objectWith(['name'], {
      id: stringId(),
      localKey: stringId(),
      name: { type: 'string' },
      timePeriod: { type: 'string' },
      description: { type: 'string' },
      visualNotes: { type: 'string' },
    }),
    act: objectWith(['sequences'], {
      id: stringId(),
      localKey: stringId(),
      title: { type: 'string' },
      purpose: { type: 'string' },
      keyBeats: { type: 'array' },
      sequences: { type: 'array', items: { $ref: '#/$defs/sequence' } },
    }),
    sequence: objectWith(['scenes'], {
      id: stringId(),
      localKey: stringId(),
      title: { type: 'string' },
      purpose: { type: 'string' },
      scenes: { type: 'array', items: { $ref: '#/$defs/scene' } },
    }),
    scene: objectWith(['title', 'setting', 'blocks'], {
      id: stringId(),
      localKey: stringId(),
      title: { type: 'string' },
      setting: { $ref: '#/$defs/sceneSetting' },
      storyFunction: { type: 'array', items: { type: 'string' } },
      blocks: {
        type: 'array',
        items: {
          $ref: 'https://schemas.gorenku.com/studio/screenplay-block.schema.json',
        },
      },
    }),
    sceneSetting: objectWith(['locationRefs'], {
      interiorExterior: { type: 'string' },
      timeOfDay: { type: 'string' },
      locationRefs: refArray(),
    }),
  },
} as const;

const entityDefs = {
  castMember: { field: 'castMember', id: 'castMemberId', parent: null },
  location: { field: 'location', id: 'locationId', parent: null },
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
        oneOf: Object.keys(entityDefs).flatMap((name) => [
          { $ref: `#/$defs/${name}Add` },
          { $ref: `#/$defs/${name}Update` },
          { $ref: `#/$defs/${name}Delete` },
          { $ref: `#/$defs/${name}Move` },
        ]),
      },
    },
  },
  additionalProperties: true,
  $defs: {
    placement: {
      oneOf: [
        objectWith(['beforeId'], { beforeId: stringId() }),
        objectWith(['afterId'], { afterId: stringId() }),
      ],
    },
    castMemberAdd: operationObject(['operation', 'castMember'], {
      operation: { const: 'castMember.add' },
      placement: { $ref: '#/$defs/placement' },
      castMember: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/castMember' },
    }),
    castMemberUpdate: operationObject(['operation', 'castMember'], {
      operation: { const: 'castMember.update' },
      castMember: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/castMember' },
    }),
    castMemberDelete: operationObject(['operation', 'castMemberId'], {
      operation: { const: 'castMember.delete' },
      castMemberId: stringId(),
    }),
    castMemberMove: operationObject(['operation', 'castMemberId', 'placement'], {
      operation: { const: 'castMember.move' },
      castMemberId: stringId(),
      placement: { $ref: '#/$defs/placement' },
    }),
    locationAdd: operationObject(['operation', 'location'], {
      operation: { const: 'location.add' },
      placement: { $ref: '#/$defs/placement' },
      location: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/location' },
    }),
    locationUpdate: operationObject(['operation', 'location'], {
      operation: { const: 'location.update' },
      location: { $ref: 'https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/location' },
    }),
    locationDelete: operationObject(['operation', 'locationId'], {
      operation: { const: 'location.delete' },
      locationId: stringId(),
    }),
    locationMove: operationObject(['operation', 'locationId', 'placement'], {
      operation: { const: 'location.move' },
      locationId: stringId(),
      placement: { $ref: '#/$defs/placement' },
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
    sequenceMove: operationObject(['operation', 'sequenceId', 'placement'], {
      operation: { const: 'sequence.move' },
      sequenceId: stringId(),
      actId: stringId(),
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
    sceneMove: operationObject(['operation', 'sceneId', 'placement'], {
      operation: { const: 'scene.move' },
      sceneId: stringId(),
      sequenceId: stringId(),
      placement: { $ref: '#/$defs/placement' },
    }),
  },
} as const;

function ref() {
  return {
    $ref: 'https://schemas.gorenku.com/studio/screenplay-reference.schema.json',
  };
}

function refArray() {
  return { type: 'array', items: ref() };
}

function stringId() {
  return { type: 'string', minLength: 1 };
}

function objectWith(required: string[], properties: Record<string, unknown>) {
  return { type: 'object', required, properties, additionalProperties: true };
}

function operationObject(required: string[], properties: Record<string, unknown>) {
  return objectWith(required, properties);
}
