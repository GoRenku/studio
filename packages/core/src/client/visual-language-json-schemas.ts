const trimmedString = {
  type: 'string',
  minLength: 1,
  pattern: '^\\S(?:[\\s\\S]*\\S)?$',
} as const;

const imageFileName = {
  ...trimmedString,
  pattern: '^[^/\\\\]+$',
} as const;

const imageFiles = {
  type: 'array',
  items: imageFileName,
} as const;

const observation = {
  type: 'object',
  required: ['text'],
  properties: {
    text: trimmedString,
    imageFiles,
  },
  additionalProperties: false,
} as const;

const pattern = {
  type: 'object',
  required: ['name', 'description'],
  properties: {
    name: trimmedString,
    description: trimmedString,
    imageFiles,
  },
  additionalProperties: false,
} as const;

export const thesisSectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-thesis-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['statement', 'principles'],
  properties: {
    statement: trimmedString,
    principles: {
      type: 'array',
      minItems: 1,
      items: trimmedString,
    },
    imageFiles,
  },
  additionalProperties: false,
} as const;

export const paletteSectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-palette-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['description', 'colors', 'observations'],
  properties: {
    description: trimmedString,
    colors: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['hex', 'name', 'meaning'],
        properties: {
          hex: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          name: trimmedString,
          meaning: trimmedString,
        },
        additionalProperties: false,
      },
    },
    observations: {
      type: 'array',
      items: observation,
    },
  },
  additionalProperties: false,
} as const;

export const toneMoodSectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-tone-mood-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['tone', 'moodTags', 'description'],
  properties: {
    tone: trimmedString,
    moodTags: {
      type: 'array',
      minItems: 1,
      items: trimmedString,
    },
    description: trimmedString,
    imageFiles,
  },
  additionalProperties: false,
} as const;

export const patternSectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-pattern-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['description', 'patterns'],
  properties: {
    description: trimmedString,
    patterns: {
      type: 'array',
      minItems: 1,
      items: pattern,
    },
  },
  additionalProperties: false,
} as const;

export const textureSectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-texture-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['description', 'observations'],
  properties: {
    description: trimmedString,
    observations: {
      type: 'array',
      items: observation,
    },
  },
  additionalProperties: false,
} as const;

export const inspiredBySectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-inspired-by-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['description', 'items'],
  properties: {
    description: trimmedString,
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'name', 'confidence', 'why'],
        properties: {
          category: { enum: ['movie', 'director', 'cinematographer'] },
          name: trimmedString,
          confidence: { enum: ['low', 'medium', 'high'] },
          why: trimmedString,
          imageFiles,
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const inspirationAnalysisSectionsSchema = {
  $id: 'https://schemas.gorenku.com/studio/inspiration-analysis-sections.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [
    'thesis',
    'palette',
    'toneMood',
    'composition',
    'lighting',
    'texture',
    'inspiredBy',
  ],
  properties: {
    thesis: { $ref: thesisSectionSchema.$id },
    palette: { $ref: paletteSectionSchema.$id },
    toneMood: { $ref: toneMoodSectionSchema.$id },
    composition: { $ref: patternSectionSchema.$id },
    lighting: { $ref: patternSectionSchema.$id },
    texture: { $ref: textureSectionSchema.$id },
    inspiredBy: { $ref: inspiredBySectionSchema.$id },
  },
  additionalProperties: false,
} as const;

export const inspirationAnalysisDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/inspiration-analysis-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'analysis'],
  properties: {
    kind: { const: 'inspirationAnalysis' },
    analysis: { $ref: inspirationAnalysisSectionsSchema.$id },
  },
  additionalProperties: false,
} as const;

export const cameraSectionSchema = {
  $id: 'https://schemas.gorenku.com/studio/visual-language-camera-section.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['description', 'movement', 'motion', 'framing'],
  properties: {
    description: trimmedString,
    movement: { type: 'array', minItems: 1, items: pattern },
    motion: { type: 'array', minItems: 1, items: pattern },
    framing: { type: 'array', minItems: 1, items: pattern },
  },
  additionalProperties: false,
} as const;

export const lookbookSectionsSchema = {
  $id: 'https://schemas.gorenku.com/studio/movie-lookbook-sections.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [
    'thesis',
    'palette',
    'toneMood',
    'composition',
    'lighting',
    'texture',
    'camera',
  ],
  properties: {
    thesis: { $ref: thesisSectionSchema.$id },
    palette: { $ref: paletteSectionSchema.$id },
    toneMood: { $ref: toneMoodSectionSchema.$id },
    composition: { $ref: patternSectionSchema.$id },
    lighting: { $ref: patternSectionSchema.$id },
    texture: { $ref: textureSectionSchema.$id },
    camera: { $ref: cameraSectionSchema.$id },
  },
  additionalProperties: false,
} as const;

const storyboardLookbookTextSection = {
  type: 'object',
  required: ['text'],
  properties: {
    text: trimmedString,
    imageFiles,
  },
  additionalProperties: false,
} as const;

export const storyboardLookbookSectionsSchema = {
  $id: 'https://schemas.gorenku.com/studio/storyboard-lookbook-sections.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [
    'styleBrief',
    'lineAndFinish',
    'valueAndAccent',
    'panelAndNotation',
    'continuityAndClarity',
    'guardrails',
  ],
  properties: {
    styleBrief: storyboardLookbookTextSection,
    lineAndFinish: storyboardLookbookTextSection,
    valueAndAccent: storyboardLookbookTextSection,
    panelAndNotation: storyboardLookbookTextSection,
    continuityAndClarity: storyboardLookbookTextSection,
    guardrails: storyboardLookbookTextSection,
  },
  additionalProperties: false,
} as const;

export const lookbookDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/lookbook-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    {
      type: 'object',
      required: ['kind', 'movieLookbook'],
      properties: {
        kind: { const: 'movieLookbook' },
        movieLookbook: {
          type: 'object',
          properties: {
            name: trimmedString,
            thesis: { $ref: thesisSectionSchema.$id },
            palette: { $ref: paletteSectionSchema.$id },
            toneMood: { $ref: toneMoodSectionSchema.$id },
            composition: { $ref: patternSectionSchema.$id },
            lighting: { $ref: patternSectionSchema.$id },
            texture: { $ref: textureSectionSchema.$id },
            camera: { $ref: cameraSectionSchema.$id },
          },
          required: [
            'name',
            'thesis',
            'palette',
            'toneMood',
            'composition',
            'lighting',
            'texture',
            'camera',
          ],
          additionalProperties: false,
        },
        sourceInspirationFolderIds: {
          type: 'array',
          items: trimmedString,
        },
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['kind', 'storyboardLookbook'],
      properties: {
        kind: { const: 'storyboardLookbook' },
        storyboardLookbook: {
          type: 'object',
          required: [
            'name',
            'styleBrief',
            'lineAndFinish',
            'valueAndAccent',
            'panelAndNotation',
            'continuityAndClarity',
            'guardrails',
          ],
          properties: {
            name: trimmedString,
            styleBrief: storyboardLookbookTextSection,
            lineAndFinish: storyboardLookbookTextSection,
            valueAndAccent: storyboardLookbookTextSection,
            panelAndNotation: storyboardLookbookTextSection,
            continuityAndClarity: storyboardLookbookTextSection,
            guardrails: storyboardLookbookTextSection,
          },
          additionalProperties: false,
        },
        sourceInspirationFolderIds: {
          type: 'array',
          items: trimmedString,
        },
        sourceMovieLookbookIds: {
          type: 'array',
          items: trimmedString,
        },
      },
      additionalProperties: false,
    },
  ],
} as const;

export const lookbookSourceInspirationsDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/lookbook-source-inspirations-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'inspirationFolderIds'],
  properties: {
    kind: { const: 'lookbookSourceInspirations' },
    inspirationFolderIds: {
      type: 'array',
      items: trimmedString,
    },
  },
  additionalProperties: false,
} as const;
