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
