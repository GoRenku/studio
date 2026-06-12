const stringValue = { type: 'string', minLength: 1 } as const;
const optionalStringValue = { type: 'string' } as const;
const stringArray = {
  type: 'array',
  items: optionalStringValue,
} as const;

export const departmentPlacementSchema = {
  $id: 'https://schemas.gorenku.com/studio/department-placement.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  anyOf: [
    { required: ['beforeId'] },
    { required: ['afterId'] },
    { required: ['position'] },
  ],
  properties: {
    beforeId: stringValue,
    afterId: stringValue,
    position: { const: 'only' },
  },
  allOf: [
    {
      if: { required: ['position'] },
      then: {
        not: {
          anyOf: [{ required: ['beforeId'] }, { required: ['afterId'] }],
        },
      },
    },
  ],
  additionalProperties: false,
} as const;

const castMemberInputSchema = {
  type: 'object',
  required: ['handle', 'name'],
  properties: {
    id: stringValue,
    key: stringValue,
    handle: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    name: stringValue,
    role: optionalStringValue,
    isVoiceOver: { type: 'boolean' },
    age: { type: 'integer', minimum: 0 },
    want: optionalStringValue,
    need: optionalStringValue,
    arc: optionalStringValue,
    voiceNotes: optionalStringValue,
    description: optionalStringValue,
  },
  additionalProperties: false,
} as const;

const locationInputSchema = {
  type: 'object',
  required: ['handle', 'name'],
  properties: {
    id: stringValue,
    key: stringValue,
    handle: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    name: stringValue,
    timePeriod: optionalStringValue,
    description: optionalStringValue,
    visualNotes: optionalStringValue,
  },
  additionalProperties: false,
} as const;

export const castOperationsSchema = {
  $id: 'https://schemas.gorenku.com/studio/cast-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'operations'],
  properties: {
    kind: { const: 'castOperations' },
    operations: {
      type: 'array',
      items: {
        oneOf: [
          operationObject(['operation', 'castMember'], {
            operation: { const: 'castMember.add' },
            castMember: castMemberInputSchema,
            placement: { $ref: 'https://schemas.gorenku.com/studio/department-placement.schema.json' },
          }),
          operationObject(['operation', 'castMember'], {
            operation: { const: 'castMember.update' },
            castMember: castMemberInputSchema,
          }),
          operationObject(['operation', 'castMemberId'], {
            operation: { const: 'castMember.delete' },
            castMemberId: stringValue,
          }),
          operationObject(['operation', 'castMemberId', 'placement'], {
            operation: { const: 'castMember.move' },
            castMemberId: stringValue,
            placement: { $ref: 'https://schemas.gorenku.com/studio/department-placement.schema.json' },
          }),
        ],
      },
    },
  },
  additionalProperties: false,
} as const;

export const locationOperationsSchema = {
  $id: 'https://schemas.gorenku.com/studio/location-operations.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'operations'],
  properties: {
    kind: { const: 'locationOperations' },
    operations: {
      type: 'array',
      items: {
        oneOf: [
          operationObject(['operation', 'location'], {
            operation: { const: 'location.add' },
            location: locationInputSchema,
            placement: { $ref: 'https://schemas.gorenku.com/studio/department-placement.schema.json' },
          }),
          operationObject(['operation', 'location'], {
            operation: { const: 'location.update' },
            location: locationInputSchema,
          }),
          operationObject(['operation', 'locationId'], {
            operation: { const: 'location.delete' },
            locationId: stringValue,
          }),
          operationObject(['operation', 'locationId', 'placement'], {
            operation: { const: 'location.move' },
            locationId: stringValue,
            placement: { $ref: 'https://schemas.gorenku.com/studio/department-placement.schema.json' },
          }),
        ],
      },
    },
  },
  additionalProperties: false,
} as const;

export const castDesignSchema = {
  $id: 'https://schemas.gorenku.com/studio/cast-design.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'castMemberId', 'design'],
  properties: {
    kind: { const: 'castDesign' },
    castMemberId: stringValue,
    title: optionalStringValue,
    design: {
      type: 'object',
      required: ['interpretation', 'appearance', 'performance', 'costume', 'continuity', 'generationGuidance'],
      properties: {
        interpretation: objectWith(['roleUnderstanding', 'audienceRead', 'contradictions'], {
          roleUnderstanding: stringValue,
          audienceRead: stringArray,
          contradictions: stringArray,
        }),
        appearance: objectWith([], {
          ageRead: optionalStringValue,
          build: optionalStringValue,
          face: optionalStringValue,
          posture: optionalStringValue,
          movement: optionalStringValue,
          grooming: optionalStringValue,
          silhouette: optionalStringValue,
        }),
        performance: objectWith(['behavioralPressure', 'stillness', 'gesture', 'statusShifts', 'sceneEnergy'], {
          behavioralPressure: stringArray,
          stillness: stringArray,
          gesture: stringArray,
          statusShifts: stringArray,
          sceneEnergy: stringArray,
        }),
        costume: objectWith(['baseWardrobeLogic', 'variants'], {
          baseWardrobeLogic: stringArray,
          variants: {
            type: 'array',
            items: objectWith(['label', 'scope', 'wardrobe'], {
              label: stringValue,
              scope: {
                oneOf: [
                  objectWith(['kind'], { kind: { const: 'project' } }),
                  objectWith(['kind', 'sequenceId'], {
                    kind: { const: 'sequence' },
                    sequenceId: stringValue,
                  }),
                  objectWith(['kind', 'sceneId'], {
                    kind: { const: 'scene' },
                    sceneId: stringValue,
                  }),
                ],
              },
              wardrobe: stringArray,
              continuityNotes: stringArray,
            }),
          },
        }),
        voiceCasting: objectWith(['voiceIdentity'], {
          voiceIdentity: stringValue,
          accent: optionalStringValue,
          tempo: optionalStringValue,
          texture: optionalStringValue,
          emotionalRange: stringArray,
          localeNotes: stringArray,
        }),
        continuity: objectWith(['mustRemainConsistent', 'canChange'], {
          mustRemainConsistent: stringArray,
          canChange: stringArray,
        }),
        generationGuidance: objectWith(['characterSheetPositive', 'characterSheetNegative', 'profilePositive', 'profileNegative'], {
          characterSheetPositive: stringArray,
          characterSheetNegative: stringArray,
          profilePositive: stringArray,
          profileNegative: stringArray,
          futureCostumeMediaNotes: stringArray,
          futureVoiceMediaNotes: stringArray,
        }),
      },
      additionalProperties: false,
    },
    openQuestions: stringArray,
  },
  additionalProperties: false,
} as const;

export const locationDesignSchema = {
  $id: 'https://schemas.gorenku.com/studio/location-design.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['kind', 'locationId', 'design'],
  properties: {
    kind: { const: 'locationDesign' },
    locationId: stringValue,
    title: optionalStringValue,
    design: objectWith(
      [
        'spatialThesis',
        'architecture',
        'setDressing',
        'materialsAndSurfaces',
        'atmosphere',
        'propsAndRecurringObjects',
        'continuity',
        'environmentSheetGuidance',
        'generationGuidance',
      ],
      {
        spatialThesis: stringValue,
        architecture: stringArray,
        setDressing: stringArray,
        materialsAndSurfaces: stringArray,
        atmosphere: stringArray,
        propsAndRecurringObjects: {
          type: 'array',
          items: objectWith(['name', 'description'], {
            name: stringValue,
            description: stringValue,
            continuityNotes: stringArray,
          }),
        },
        continuity: stringArray,
        environmentSheetGuidance: stringArray,
        generationGuidance: stringArray,
      }
    ),
    openQuestions: stringArray,
  },
  additionalProperties: false,
} as const;

function operationObject(required: string[], properties: Record<string, unknown>) {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  } as const;
}

function objectWith(required: string[], properties: Record<string, unknown>) {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  } as const;
}
