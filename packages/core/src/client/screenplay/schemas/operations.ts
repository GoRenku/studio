const nonEmptyString = { type: 'string', minLength: 1 } as const;
const stringArray = { type: 'array', items: nonEmptyString } as const;
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

const identityProperties = {
  id: nonEmptyString,
  key: nonEmptyString,
} as const;

const identityBranches = [
  {
    required: ['id'],
    not: { required: ['key'] },
  },
  {
    required: ['key'],
    not: { required: ['id'] },
  },
] as const;

const authoringReference = authoringObject([], {});

const dialoguePartInput = {
  oneOf: [
    authoringObject(['type', 'text'], {
      type: { const: 'speech' },
      text: nonEmptyString,
    }),
    authoringObject(['type', 'text'], {
      type: { const: 'parenthetical' },
      text: nonEmptyString,
    }),
  ],
} as const;

const dialoguePartsInput = {
  type: 'array',
  minItems: 1,
  items: dialoguePartInput,
  contains: {
    type: 'object',
    required: ['type'],
    properties: { type: { const: 'speech' } },
  },
} as const;

const dialogueTurnInput = authoringObject(
  ['characterName', 'extensions', 'parts'],
  {
    characterName: nonEmptyString,
    extensions: stringArray,
    parts: dialoguePartsInput,
  }
);

const textBlockInput = authoringObject(['type', 'text'], {
  type: { enum: textBlockTypes },
  text: nonEmptyString,
});

const screenplayBlockInput = {
  oneOf: [
    textBlockInput,
    authoringObject(['type', 'characterName', 'extensions', 'parts'], {
      type: { const: 'dialogue' },
      characterName: nonEmptyString,
      extensions: stringArray,
      parts: dialoguePartsInput,
    }),
    authoringObject(['type', 'left', 'right'], {
      type: { const: 'dualDialogue' },
      left: dialogueTurnInput,
      right: dialogueTurnInput,
    }),
  ],
} as const;

const sceneInput = authoringObject(['heading', 'blocks'], {
  productionNumber: nonEmptyString,
  heading: nonEmptyString,
  title: nonEmptyString,
  blocks: { type: 'array', items: screenplayBlockInput },
});

const sectionInput = authoringObject(['type', 'title'], {
  type: { enum: ['act', 'sequence'] },
  title: nonEmptyString,
  description: nonEmptyString,
});

const structureContentInput = {
  oneOf: [
    closedObject(['type', 'scene'], {
      type: { const: 'scene' },
      scene: authoringReference,
    }),
    closedObject(['type', 'section'], {
      type: { const: 'section' },
      section: authoringReference,
    }),
  ],
} as const;

const structureEntryInput = authoringObject(['content', 'position'], {
  parentSection: authoringReference,
  content: structureContentInput,
  position: { type: 'integer', minimum: 0 },
});

const subjectInput = {
  oneOf: [
    closedObject(['type', 'id'], {
      type: { const: 'castMember' },
      id: nonEmptyString,
    }),
    closedObject(['type', 'id'], {
      type: { const: 'location' },
      id: nonEmptyString,
    }),
    closedObject(['type', 'id'], {
      type: { const: 'prop' },
      id: nonEmptyString,
    }),
  ],
} as const;

const referenceTargetInput = {
  oneOf: [
    closedObject(['type', 'element'], {
      type: { const: 'openingElement' },
      element: authoringReference,
    }),
    closedObject(['type', 'scene'], {
      type: { const: 'scene' },
      scene: authoringReference,
    }),
    closedObject(['type', 'scene'], {
      type: { const: 'sceneHeading' },
      scene: authoringReference,
    }),
    closedObject(['type', 'scene', 'block'], {
      type: { const: 'block' },
      scene: authoringReference,
      block: authoringReference,
    }),
    closedObject(['type', 'scene', 'turn'], {
      type: { const: 'dialogueCue' },
      scene: authoringReference,
      turn: authoringReference,
    }),
    closedObject(['type', 'scene', 'turn', 'part'], {
      type: { const: 'dialoguePart' },
      scene: authoringReference,
      turn: authoringReference,
      part: authoringReference,
    }),
  ],
} as const;

const referenceInput = authoringObject(['subject', 'target', 'role'], {
  subject: subjectInput,
  target: referenceTargetInput,
  role: { enum: ['speaker', 'setting', 'mention', 'presence'] },
  range: {
    $ref: 'https://schemas.gorenku.com/studio/screenplay/text-range.schema.json',
  },
});

const placement = {
  oneOf: [
    closedObject(['at'], {
      parentSection: authoringReference,
      at: { enum: ['start', 'end'] },
    }),
    closedObject(['beforeEntry'], {
      parentSection: authoringReference,
      beforeEntry: authoringReference,
    }),
    closedObject(['afterEntry'], {
      parentSection: authoringReference,
      afterEntry: authoringReference,
    }),
  ],
} as const;

export const screenplayInputSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/input.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(
    ['opening', 'scenes', 'sections', 'structure', 'references'],
    {
      opening: { type: 'array', items: textBlockInput },
      scenes: { type: 'array', items: sceneInput },
      sections: { type: 'array', items: sectionInput },
      structure: { type: 'array', items: structureEntryInput },
      references: { type: 'array', items: referenceInput },
    }
  ),
} as const;

export const screenplayOperationSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/operation.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    closedObject(['operation', 'opening'], {
      operation: { const: 'opening.replace' },
      opening: { type: 'array', items: textBlockInput },
    }),
    closedObject(
      ['operation', 'scene', 'structureEntryKey', 'placement'],
      {
        operation: { const: 'scene.add' },
        scene: sceneInput,
        structureEntryKey: nonEmptyString,
        placement,
      }
    ),
    closedObject(['operation', 'scene'], {
      operation: { const: 'scene.update' },
      scene: sceneInput,
    }),
    closedObject(['operation', 'scene'], {
      operation: { const: 'scene.delete' },
      scene: authoringReference,
    }),
    closedObject(['operation', 'scene', 'placement'], {
      operation: { const: 'scene.move' },
      scene: authoringReference,
      placement,
    }),
    closedObject(
      ['operation', 'section', 'structureEntryKey', 'placement'],
      {
        operation: { const: 'section.add' },
        section: sectionInput,
        structureEntryKey: nonEmptyString,
        placement,
      }
    ),
    closedObject(['operation', 'section'], {
      operation: { const: 'section.update' },
      section: sectionInput,
    }),
    closedObject(['operation', 'section'], {
      operation: { const: 'section.delete' },
      section: authoringReference,
    }),
    closedObject(['operation', 'section', 'placement'], {
      operation: { const: 'section.move' },
      section: authoringReference,
      placement,
    }),
    closedObject(['operation', 'reference'], {
      operation: { const: 'reference.add' },
      reference: referenceInput,
    }),
    closedObject(['operation', 'reference'], {
      operation: { const: 'reference.delete' },
      reference: authoringReference,
    }),
  ],
} as const;

export const screenplayOperationsInputSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/operations-input.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['operations'], {
    operations: {
      type: 'array',
      minItems: 1,
      items: {
        $ref: 'https://schemas.gorenku.com/studio/screenplay/operation.schema.json',
      },
    },
  }),
} as const;

const diagnosticLocationSchema = closedObject(['path'], {
  filePath: nonEmptyString,
  path: {
    type: 'array',
    items: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
  },
  context: nonEmptyString,
});

const diagnosticIssueSchema = closedObject(
  ['code', 'message', 'severity', 'location'],
  {
    code: nonEmptyString,
    message: nonEmptyString,
    severity: { enum: ['error', 'warning'] },
    location: diagnosticLocationSchema,
    suggestion: nonEmptyString,
  }
);

export const screenplayMutationReportSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/mutation-report.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(
    [
      'valid',
      'warnings',
      'project',
      'screenplayRevisionId',
      'generatedIdentities',
      'resourceKeys',
    ],
    {
      valid: { const: true },
      warnings: { type: 'array', items: diagnosticIssueSchema },
      project: closedObject(['id', 'projectName'], {
        id: nonEmptyString,
        projectName: nonEmptyString,
      }),
      screenplayRevisionId: nonEmptyString,
      generatedIdentities: {
        type: 'array',
        items: closedObject(['kind', 'key', 'id'], {
          kind: {
            enum: [
              'scene',
              'block',
              'dialogueBlock',
              'dialogueTurn',
              'dialoguePart',
              'section',
              'structureEntry',
              'reference',
            ],
          },
          key: nonEmptyString,
          id: nonEmptyString,
        }),
      },
      resourceKeys: { type: 'array', items: nonEmptyString },
    }
  ),
} as const;

function authoringObject<
  TRequired extends readonly string[],
  TProperties extends Record<string, unknown>,
>(required: TRequired, properties: TProperties) {
  return {
    type: 'object',
    required,
    properties: {
      ...identityProperties,
      ...properties,
    },
    oneOf: identityBranches,
    additionalProperties: false,
  } as const;
}

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
