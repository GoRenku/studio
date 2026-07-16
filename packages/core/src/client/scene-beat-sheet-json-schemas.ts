export const sceneBeatSheetDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-beat-sheet-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [
    'kind',
    'sceneId',
    'title',
    'summary',
    'narrativeProgression',
    'beats',
  ],
  properties: {
    kind: { const: 'sceneBeatSheet' },
    sceneId: nonEmptyString(),
    title: nonEmptyString(),
    summary: nonEmptyString(),
    narrativeProgression: nonEmptyString(),
    baseBeatSheetId: {
      anyOf: [nonEmptyString(), { type: 'null' }],
    },
    lookbookInfluence: nonEmptyString(),
    beats: beatArraySchema({ minItems: 1 }),
    openQuestions: nonEmptyStringArraySchema(),
  },
  additionalProperties: false,
} as const;

export const sceneBeatSheetOperationDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-beat-sheet-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'sceneId', 'baseBeatSheetId', 'activate', 'operations'],
  properties: {
    kind: { const: 'sceneBeatSheetOperations' },
    sceneId: nonEmptyString(),
    baseBeatSheetId: nonEmptyString(),
    activate: { type: 'boolean' },
    title: nonEmptyString(),
    summary: nonEmptyString(),
    narrativeProgression: nonEmptyString(),
    lookbookInfluence: nonEmptyString(),
    operations: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          objectWith(['operation', 'placement', 'beats'], {
            operation: { const: 'beats.insert' },
            placement: {
              oneOf: [
                objectWith(['position'], { position: { const: 'start' } }),
                objectWith(['position'], { position: { const: 'end' } }),
                objectWith(['position', 'beatId'], {
                  position: { const: 'before' },
                  beatId: nonEmptyString(),
                }),
                objectWith(['position', 'beatId'], {
                  position: { const: 'after' },
                  beatId: nonEmptyString(),
                }),
              ],
            },
            beats: beatArraySchema({ minItems: 1 }),
            storyboardPolicy: storyboardPolicySchema(),
          }),
          objectWith(['operation', 'beatIds', 'beats'], {
            operation: { const: 'beats.replace' },
            beatIds: nonEmptyStringArraySchema({ minItems: 1 }),
            beats: beatArraySchema({ minItems: 1 }),
            storyboardPolicy: storyboardPolicySchema(),
          }),
          objectWith(['operation', 'beat'], {
            operation: { const: 'beat.update' },
            beat: beatSchema(),
            storyboardPolicy: storyboardPolicySchema(),
          }),
          objectWith(['operation', 'beatIds'], {
            operation: { const: 'beats.delete' },
            beatIds: nonEmptyStringArraySchema({ minItems: 1 }),
          }),
          objectWith(['operation', 'beats'], {
            operation: { const: 'beatSheet.replace' },
            beats: beatArraySchema({ minItems: 1 }),
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
  required: ['kind', 'beatSheetId', 'beats'],
  properties: {
    kind: { const: 'sceneStoryboardImagesImport' },
    title: nonEmptyString(),
    beatSheetId: nonEmptyString(),
    beats: {
      type: 'array',
      minItems: 1,
      items: objectWith(['beatId', 'source'], {
        beatId: nonEmptyString(),
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

function beatSchema(): Record<string, unknown> {
  return objectWith(
    [
      'id',
      'title',
      'description',
      'narrativeDevelopment',
      'narrativePurpose',
      'castMemberIds',
      'locationIds',
      'screenplayBlockIndexes',
    ],
    {
      id: nonEmptyString(),
      title: nonEmptyString(),
      description: nonEmptyString(),
      narrativeDevelopment: nonEmptyString(),
      narrativePurpose: nonEmptyString(),
      castMemberIds: nonEmptyStringArraySchema(),
      locationIds: nonEmptyStringArraySchema(),
      screenplayBlockIndexes: {
        type: 'array',
        items: nonNegativeInteger(),
      },
    }
  );
}

function beatArraySchema(input: { minItems?: number } = {}): Record<string, unknown> {
  return {
    type: 'array',
    ...(input.minItems !== undefined ? { minItems: input.minItems } : {}),
    items: beatSchema(),
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
