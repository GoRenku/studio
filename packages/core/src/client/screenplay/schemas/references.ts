const nonEmptyString = { type: 'string', minLength: 1 } as const;

const castSubject = closedObject(['type', 'id'], {
  type: { const: 'castMember' },
  id: nonEmptyString,
});
const locationSubject = closedObject(['type', 'id'], {
  type: { const: 'location' },
  id: nonEmptyString,
});
const propSubject = closedObject(['type', 'id'], {
  type: { const: 'prop' },
  id: nonEmptyString,
});
const anySubject = { oneOf: [castSubject, locationSubject, propSubject] } as const;

const openingTarget = closedObject(['type', 'elementId'], {
  type: { const: 'openingElement' },
  elementId: nonEmptyString,
});
const sceneTarget = closedObject(['type', 'sceneId'], {
  type: { const: 'scene' },
  sceneId: nonEmptyString,
});
const sceneHeadingTarget = closedObject(['type', 'sceneId'], {
  type: { const: 'sceneHeading' },
  sceneId: nonEmptyString,
});
const blockTarget = closedObject(['type', 'sceneId', 'blockId'], {
  type: { const: 'block' },
  sceneId: nonEmptyString,
  blockId: nonEmptyString,
});
const dialogueCueTarget = closedObject(['type', 'sceneId', 'turnId'], {
  type: { const: 'dialogueCue' },
  sceneId: nonEmptyString,
  turnId: nonEmptyString,
});
const dialoguePartTarget = closedObject(
  ['type', 'sceneId', 'turnId', 'partId'],
  {
    type: { const: 'dialoguePart' },
    sceneId: nonEmptyString,
    turnId: nonEmptyString,
    partId: nonEmptyString,
  }
);

export const screenplayTextRangeSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/text-range.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['start', 'length'], {
    start: { type: 'integer', minimum: 0 },
    length: { type: 'integer', minimum: 1 },
  }),
} as const;

export const screenplayReferenceSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/reference.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    closedObject(['id', 'subject', 'target', 'role'], {
      id: nonEmptyString,
      subject: castSubject,
      target: dialogueCueTarget,
      role: { const: 'speaker' },
    }),
    closedObject(['id', 'subject', 'target', 'role'], {
      id: nonEmptyString,
      subject: locationSubject,
      target: { oneOf: [sceneTarget, sceneHeadingTarget] },
      role: { const: 'setting' },
    }),
    closedObject(['id', 'subject', 'target', 'role', 'range'], {
      id: nonEmptyString,
      subject: anySubject,
      target: {
        oneOf: [
          openingTarget,
          sceneHeadingTarget,
          blockTarget,
          dialogueCueTarget,
          dialoguePartTarget,
        ],
      },
      role: { const: 'mention' },
      range: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/text-range.schema.json',
      },
    }),
    closedObject(['id', 'subject', 'target', 'role'], {
      id: nonEmptyString,
      subject: anySubject,
      target: { oneOf: [sceneTarget, blockTarget] },
      role: { const: 'presence' },
    }),
  ],
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
