const sectionText = { type: 'string', minLength: 1, pattern: '\\S' } as const;

export const castMemberDescriptionSchema = {
  $id: 'https://schemas.gorenku.com/studio/cast-member-description.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  minProperties: 1,
  properties: {
    overview: sectionText,
    appearance: sectionText,
    behavior: sectionText,
    wardrobe: sectionText,
    performance: sectionText,
    sourceNotes: sectionText,
  },
  additionalProperties: false,
} as const;

export const locationDescriptionSchema = {
  $id: 'https://schemas.gorenku.com/studio/location-description.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  minProperties: 1,
  properties: {
    overview: sectionText,
    storyUse: sectionText,
    spaceAndLayout: sectionText,
    statesAndChanges: sectionText,
    sourceNotes: sectionText,
  },
  additionalProperties: false,
} as const;

export const propDescriptionSchema = {
  $id: 'https://schemas.gorenku.com/studio/prop-description.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  minProperties: 1,
  properties: {
    overview: sectionText,
    storyUse: sectionText,
    formAndMaterials: sectionText,
    statesAndContinuity: sectionText,
    sourceNotes: sectionText,
  },
  additionalProperties: false,
} as const;
