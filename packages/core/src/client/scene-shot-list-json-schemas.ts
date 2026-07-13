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
