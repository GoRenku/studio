const nonEmptyString = { type: 'string', minLength: 1 } as const;
const stringArray = { type: 'array', items: nonEmptyString } as const;

const beatInputSchema = closedObject(
  [
    'title', 'description', 'narrativeDevelopment', 'narrativePurpose',
    'castMemberIds', 'locationIds', 'propIds', 'screenplayBlockIds',
  ],
  {
    title: nonEmptyString,
    description: nonEmptyString,
    narrativeDevelopment: nonEmptyString,
    narrativePurpose: nonEmptyString,
    castMemberIds: stringArray,
    locationIds: stringArray,
    propIds: stringArray,
    screenplayBlockIds: stringArray,
  },
);

const beatInputsSchema = { type: 'array', minItems: 1, items: beatInputSchema } as const;

export const sceneBeatsInputSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-beats.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['sceneId', 'beats'], {
    sceneId: nonEmptyString,
    beats: beatInputsSchema,
  }),
} as const;

export const sceneBeatsOperationsInputSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-beats-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['sceneId', 'baseRevisionId', 'activate', 'operations'], {
    sceneId: nonEmptyString,
    baseRevisionId: nonEmptyString,
    activate: { type: 'boolean' },
    operations: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          closedObject(['operation', 'placement', 'beats'], {
            operation: { const: 'beats.insert' },
            placement: {
              oneOf: [
                closedObject(['position'], { position: { const: 'start' } }),
                closedObject(['position'], { position: { const: 'end' } }),
                closedObject(['position', 'beatId'], { position: { const: 'before' }, beatId: nonEmptyString }),
                closedObject(['position', 'beatId'], { position: { const: 'after' }, beatId: nonEmptyString }),
              ],
            },
            beats: beatInputsSchema,
          }),
          closedObject(['operation', 'beatId', 'beat'], {
            operation: { const: 'beat.update' },
            beatId: nonEmptyString,
            beat: beatInputSchema,
          }),
          closedObject(['operation', 'beatIds'], {
            operation: { const: 'beats.delete' },
            beatIds: { type: 'array', minItems: 1, items: nonEmptyString },
          }),
        ],
      },
    },
  }),
} as const;

export const sceneStoryboardImagesImportDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-storyboard-images-import.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['select', 'sceneBeatsRevisionId', 'beats'], {
    select: { type: 'boolean' },
    title: nonEmptyString,
    sceneBeatsRevisionId: nonEmptyString,
    beats: {
      type: 'array',
      minItems: 1,
      items: closedObject(['beatId', 'source'], {
        beatId: nonEmptyString,
        source: nonEmptyString,
        title: nonEmptyString,
        sourcePurpose: { const: 'scene.storyboard-sheet' },
        sourceSpecId: nonEmptyString,
        sourceRunId: nonEmptyString,
      }),
    },
  }),
} as const;

function closedObject<
  TRequired extends readonly string[],
  TProperties extends Record<string, unknown>,
>(required: TRequired, properties: TProperties) {
  return { type: 'object', required, properties, additionalProperties: false } as const;
}
