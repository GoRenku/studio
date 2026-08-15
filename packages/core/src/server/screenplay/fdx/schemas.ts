const nonEmptyString = { type: 'string', minLength: 1 } as const;
const nonNegativeInteger = { type: 'integer', minimum: 0 } as const;

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
const dialoguePartTarget = closedObject(['type', 'sceneId', 'turnId', 'partId'], {
  type: { const: 'dialoguePart' },
  sceneId: nonEmptyString,
  turnId: nonEmptyString,
  partId: nonEmptyString,
});
const referenceTarget = {
  oneOf: [
    openingTarget,
    sceneTarget,
    sceneHeadingTarget,
    blockTarget,
    dialogueCueTarget,
    dialoguePartTarget,
  ],
} as const;

export const screenplayImportLogEntrySchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/fdx-import-log-entry.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    closedObject(
      ['type', 'sourceParagraphIndex', 'sourceParagraphType', 'targetBlockType'],
      {
        type: { const: 'paragraphNormalization' },
        sourceParagraphIndex: nonNegativeInteger,
        sourceParagraphType: { const: 'General' },
        targetBlockType: { enum: ['action', 'transition'] },
      },
    ),
    closedObject(
      ['type', 'sourceParagraphIndex', 'sourceParagraphType', 'targetBlockType'],
      {
        type: { const: 'orphanDialogueNormalization' },
        sourceParagraphIndex: nonNegativeInteger,
        sourceParagraphType: { const: 'Dialogue' },
        targetBlockType: { const: 'action' },
      },
    ),
  ],
} as const;

export const screenplayImportSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/fdx-import.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(
    [
      'id',
      'sourceAssetId',
      'sourceAssetFileId',
      'importerVersion',
      'importedAt',
      'technicalLog',
    ],
    {
      id: nonEmptyString,
      sourceAssetId: nonEmptyString,
      sourceAssetFileId: nonEmptyString,
      importerVersion: { const: 1 },
      importedAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$' },
      technicalLog: {
        type: 'array',
        items: { $ref: screenplayImportLogEntrySchema.$id },
      },
    },
  ),
} as const;

export const screenplayImportCandidatesSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/fdx-import-candidates.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(['characterCues', 'sceneHeadings', 'taggedSubjects'], {
    characterCues: {
      type: 'array',
      items: closedObject(['characterName', 'turnIds'], {
        characterName: nonEmptyString,
        turnIds: { type: 'array', items: nonEmptyString, minItems: 1 },
      }),
    },
    sceneHeadings: {
      type: 'array',
      items: closedObject(['sceneId', 'heading'], {
        sceneId: nonEmptyString,
        heading: nonEmptyString,
      }),
    },
    taggedSubjects: {
      type: 'array',
      items: closedObject(['label', 'category', 'target'], {
        label: nonEmptyString,
        category: nonEmptyString,
        target: referenceTarget,
      }),
    },
  }),
} as const;

export const importFdxScreenplayReportSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay/fdx-import-report.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closedObject(
    ['valid', 'warnings', 'status', 'project', 'screenplayImport', 'counts', 'candidates', 'resourceKeys'],
    {
      valid: { const: true },
      warnings: { type: 'array', maxItems: 0 },
      status: { enum: ['imported', 'refreshed', 'unchanged'] },
      project: closedObject(['id', 'projectName'], {
        id: nonEmptyString,
        projectName: nonEmptyString,
      }),
      screenplayImport: closedObject(
        [
          'id',
          'sourceAssetId',
          'sourceAssetFileId',
          'importerVersion',
          'importedAt',
          'sourceFilename',
          'sha256',
        ],
        {
          id: nonEmptyString,
          sourceAssetId: nonEmptyString,
          sourceAssetFileId: nonEmptyString,
          importerVersion: { const: 1 },
          importedAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$' },
          sourceFilename: nonEmptyString,
          sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
        },
      ),
      counts: closedObject(
        ['scenes', 'blocks', 'dialogueTurns', 'productionSceneNumbers'],
        {
          scenes: nonNegativeInteger,
          blocks: nonNegativeInteger,
          dialogueTurns: nonNegativeInteger,
          productionSceneNumbers: nonNegativeInteger,
        },
      ),
      candidates: { $ref: screenplayImportCandidatesSchema.$id },
      resourceKeys: { type: 'array', items: nonEmptyString },
    },
  ),
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
