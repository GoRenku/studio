const nonEmptyString = { type: 'string', minLength: 1 } as const;
const stringArray = { type: 'array', items: nonEmptyString } as const;

const beatSchema = closedObject(
  [
    'id', 'title', 'description', 'narrativeDevelopment', 'narrativePurpose',
    'castMemberIds', 'locationIds', 'propIds', 'screenplayBlockIds',
  ],
  {
    id: nonEmptyString,
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

const beatsSchema = { type: 'array', minItems: 1, items: beatSchema } as const;

export const sceneBeatSheetDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-beat-sheet.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['sceneId', 'title', 'summary', 'narrativeProgression', 'beats'], {
    sceneId: nonEmptyString,
    title: nonEmptyString,
    summary: nonEmptyString,
    narrativeProgression: nonEmptyString,
    baseBeatSheetId: nonEmptyString,
    lookbookInfluence: nonEmptyString,
    beats: beatsSchema,
    openQuestions: { type: 'array', minItems: 1, items: nonEmptyString },
  }),
} as const;

export const sceneBeatSheetOperationDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-beat-sheet-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['sceneId', 'baseBeatSheetId', 'activate', 'operations'], {
    sceneId: nonEmptyString,
    baseBeatSheetId: nonEmptyString,
    activate: { type: 'boolean' },
    title: nonEmptyString,
    summary: nonEmptyString,
    narrativeProgression: nonEmptyString,
    lookbookInfluence: nonEmptyString,
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
            beats: beatsSchema,
            storyboardPolicy: storyboardPolicy(),
          }),
          closedObject(['operation', 'beatIds', 'beats'], {
            operation: { const: 'beats.replace' },
            beatIds: { type: 'array', minItems: 1, items: nonEmptyString },
            beats: beatsSchema,
            storyboardPolicy: storyboardPolicy(),
          }),
          closedObject(['operation', 'beat'], {
            operation: { const: 'beat.update' },
            beat: beatSchema,
            storyboardPolicy: storyboardPolicy(),
          }),
          closedObject(['operation', 'beatIds'], {
            operation: { const: 'beats.delete' },
            beatIds: { type: 'array', minItems: 1, items: nonEmptyString },
          }),
          closedObject(['operation', 'beats'], {
            operation: { const: 'beatSheet.replace' },
            beats: beatsSchema,
            storyboardPolicy: storyboardPolicy(),
          }),
        ],
      },
    },
    openQuestions: { type: 'array', minItems: 1, items: nonEmptyString },
  }),
} as const;

export const sceneStoryboardImagesImportDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/scene-storyboard-images-import.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['select', 'beatSheetId', 'beats'], {
    select: { type: 'boolean' },
    title: nonEmptyString,
    beatSheetId: nonEmptyString,
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

function storyboardPolicy() {
  return { enum: ['generate', 'reuse-if-unchanged', 'missing-only'] } as const;
}

function closedObject<
  TRequired extends readonly string[],
  TProperties extends Record<string, unknown>,
>(required: TRequired, properties: TProperties) {
  return { type: 'object', required, properties, additionalProperties: false } as const;
}
