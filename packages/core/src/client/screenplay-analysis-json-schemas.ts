export const screenplayAnalysisDocumentSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-analysis-document.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [
    'kind',
    'structureModel',
    'title',
    'summary',
    'criteria',
    'acts',
    'keyBeats',
    'sequences',
    'scenes',
    'suggestedSceneAdditions',
  ],
  properties: {
    kind: { const: 'screenplayAnalysis' },
    structureModel: { const: 'threeAct' },
    title: nonEmptyString(),
    summary: nonEmptyString(),
    criteria: {
      type: 'array',
      minItems: 1,
      items: objectWith(['key', 'label', 'description'], {
        key: criterionKey(),
        label: nonEmptyString(),
        description: nonEmptyString(),
      }),
    },
    acts: {
      type: 'array',
      items: objectWith(
        ['actId', 'actRole', 'title', 'synopsis', 'scoreByCriterion', 'critique'],
        {
          actId: idString(),
          actRole: { enum: ['actOne', 'actTwo', 'actThree'] },
          title: nonEmptyString(),
          synopsis: nonEmptyString(),
          scoreByCriterion: scoreMap(),
          critique: { $ref: '#/$defs/critique' },
        }
      ),
    },
    keyBeats: {
      type: 'array',
      items: objectWith(
        ['key', 'label', 'actId', 'synopsis', 'scoreByCriterion', 'critique'],
        {
          key: beatRole(),
          label: nonEmptyString(),
          actId: idString(),
          sequenceId: idString(),
          sceneId: idString(),
          synopsis: nonEmptyString(),
          scoreByCriterion: scoreMap(),
          critique: { $ref: '#/$defs/critique' },
        }
      ),
    },
    sequences: {
      type: 'array',
      items: objectWith(
        ['sequenceId', 'actId', 'title', 'synopsis', 'scoreByCriterion', 'critique'],
        {
          sequenceId: idString(),
          actId: idString(),
          title: nonEmptyString(),
          synopsis: nonEmptyString(),
          beatRole: beatRole(),
          scoreByCriterion: scoreMap(),
          critique: { $ref: '#/$defs/critique' },
        }
      ),
    },
    scenes: {
      type: 'array',
      items: objectWith(
        ['sceneId', 'sequenceId', 'actId', 'title', 'synopsis', 'scoreByCriterion', 'critique'],
        {
          sceneId: idString(),
          sequenceId: idString(),
          actId: idString(),
          title: nonEmptyString(),
          synopsis: nonEmptyString(),
          beatRole: beatRole(),
          scoreByCriterion: scoreMap(),
          critique: { $ref: '#/$defs/critique' },
        }
      ),
    },
    suggestedSceneAdditions: {
      type: 'array',
      items: objectWith(
        ['targetActId', 'title', 'purpose', 'synopsis', 'rationale'],
        {
          targetActId: idString(),
          targetSequenceId: idString(),
          placement: objectWith([], {
            beforeSceneId: idString(),
            afterSceneId: idString(),
          }),
          title: nonEmptyString(),
          purpose: nonEmptyString(),
          synopsis: nonEmptyString(),
          rationale: nonEmptyString(),
          expectedCriterionChanges: {
            type: 'array',
            items: objectWith(['criterionKey', 'direction', 'reason'], {
              criterionKey: criterionKey(),
              direction: { enum: ['increase', 'decrease', 'clarify'] },
              reason: nonEmptyString(),
            }),
          },
        }
      ),
    },
  },
  additionalProperties: false,
  $defs: {
    critique: objectWith(['summary', 'evidence', 'suggestions'], {
      summary: nonEmptyString(),
      strengths: stringArray(),
      concerns: stringArray(),
      evidence: {
        type: 'array',
        minItems: 1,
        items: objectWith(['text'], {
          sceneId: idString(),
          text: nonEmptyString(),
        }),
      },
      suggestions: {
        type: 'array',
        minItems: 1,
        items: nonEmptyString(),
      },
    }),
  },
} as const;

function objectWith(
  required: string[],
  properties: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  };
}

function nonEmptyString(): Record<string, unknown> {
  return { type: 'string', minLength: 1 };
}

function idString(): Record<string, unknown> {
  return { type: 'string', minLength: 1 };
}

function criterionKey(): Record<string, unknown> {
  return { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9]*$' };
}

function stringArray(): Record<string, unknown> {
  return {
    type: 'array',
    items: nonEmptyString(),
  };
}

function scoreMap(): Record<string, unknown> {
  return {
    type: 'object',
    minProperties: 1,
    patternProperties: {
      '^[A-Za-z][A-Za-z0-9]*$': {
        type: 'integer',
        minimum: 0,
        maximum: 100,
      },
    },
    additionalProperties: false,
  };
}

function beatRole(): Record<string, unknown> {
  return {
    enum: [
      'hook',
      'incitingIncident',
      'firstPlotPoint',
      'firstPinchPoint',
      'midpoint',
      'secondPinchPoint',
      'secondPlotPoint',
      'climax',
      'resolution',
    ],
  };
}
