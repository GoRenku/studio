const nonEmptyString = { type: 'string', minLength: 1 } as const;
const stringArray = {
  type: 'array',
  items: nonEmptyString,
} as const;

const textBlockTypes = [
  'action',
  'transition',
  'shot',
  'lyrics',
  'castList',
  'note',
  'specialHeading',
  'titleCard',
  'super',
] as const;

const dialoguePartSchema = {
  oneOf: [
    closedObject(['id', 'type', 'text'], {
      id: nonEmptyString,
      type: { const: 'speech' },
      text: nonEmptyString,
    }),
    closedObject(['id', 'type', 'text'], {
      id: nonEmptyString,
      type: { const: 'parenthetical' },
      text: nonEmptyString,
    }),
  ],
} as const;

const dialoguePartsSchema = {
  type: 'array',
  minItems: 1,
  items: dialoguePartSchema,
  contains: {
    type: 'object',
    required: ['type'],
    properties: { type: { const: 'speech' } },
  },
} as const;

const dialogueTurnSchema = closedObject(
  ['id', 'characterName', 'extensions', 'parts'],
  {
    id: nonEmptyString,
    characterName: nonEmptyString,
    extensions: stringArray,
    parts: dialoguePartsSchema,
  }
);

export const screenplayBlockSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/block.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    closedObject(['id', 'type', 'text'], {
      id: nonEmptyString,
      type: { enum: textBlockTypes },
      text: nonEmptyString,
    }),
    closedObject(['id', 'type', 'characterName', 'extensions', 'parts'], {
      id: nonEmptyString,
      type: { const: 'dialogue' },
      characterName: nonEmptyString,
      extensions: stringArray,
      parts: dialoguePartsSchema,
    }),
    closedObject(['id', 'type', 'left', 'right'], {
      id: nonEmptyString,
      type: { const: 'dualDialogue' },
      left: dialogueTurnSchema,
      right: dialogueTurnSchema,
    }),
  ],
} as const;

export const openingElementSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/opening-element.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['id', 'type', 'text'], {
    id: nonEmptyString,
    type: { enum: textBlockTypes },
    text: nonEmptyString,
  }),
} as const;

export const sceneSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/scene.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['id', 'heading', 'blocks'], {
    id: nonEmptyString,
    productionNumber: { type: 'string' },
    heading: nonEmptyString,
    title: nonEmptyString,
    blocks: {
      type: 'array',
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/block.schema.json',
      },
    },
  }),
} as const;

function closedObject<
  TRequired extends readonly string[],
  TProperties extends Record<string, unknown>,
>(required: TRequired, properties: TProperties) {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  } as const;
}
