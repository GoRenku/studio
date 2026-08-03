const nonEmptyString = { type: 'string', minLength: 1 } as const;

export const screenplaySectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['id', 'type', 'title'],
  properties: {
    id: nonEmptyString,
    type: { enum: ['act', 'sequence'] },
    title: nonEmptyString,
    description: nonEmptyString,
  },
  additionalProperties: false,
} as const;

export const screenplayStructureEntrySchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/structure-entry.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['id', 'content', 'position'],
  properties: {
    id: nonEmptyString,
    parentSectionId: nonEmptyString,
    content: {
      oneOf: [
        {
          type: 'object',
          required: ['type', 'sceneId'],
          properties: {
            type: { const: 'scene' },
            sceneId: nonEmptyString,
          },
          additionalProperties: false,
        },
        {
          type: 'object',
          required: ['type', 'sectionId'],
          properties: {
            type: { const: 'section' },
            sectionId: nonEmptyString,
          },
          additionalProperties: false,
        },
      ],
    },
    position: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const;

export const screenplaySchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['opening', 'scenes', 'sections', 'structure', 'references'],
  properties: {
    opening: {
      type: 'array',
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/opening-element.schema.json',
      },
    },
    scenes: {
      type: 'array',
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/scene.schema.json',
      },
    },
    sections: {
      type: 'array',
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/section.schema.json',
      },
    },
    structure: {
      type: 'array',
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/structure-entry.schema.json',
      },
    },
    references: {
      type: 'array',
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/reference.schema.json',
      },
    },
  },
  additionalProperties: false,
} as const;
