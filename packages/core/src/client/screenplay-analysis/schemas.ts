const nonEmptyString = { type: 'string', minLength: 1 } as const;
const usefulString = { type: 'string', minLength: 3 } as const;
const nonEmptyStrings = { type: 'array', minItems: 1, items: nonEmptyString } as const;
const sceneIds = { type: 'array', minItems: 1, items: nonEmptyString } as const;
const beatRole = {
  enum: ['hook', 'incitingIncident', 'firstPlotPoint', 'firstPinchPoint', 'midpoint', 'secondPinchPoint', 'secondPlotPoint', 'climax', 'resolution'],
} as const;
const scoreMap = {
  type: 'object',
  propertyNames: nonEmptyString,
  additionalProperties: { type: 'integer', minimum: 0, maximum: 100 },
} as const;
const evidence = closed(['text'], { sceneId: nonEmptyString, text: usefulString });
const critique = closed(['summary', 'evidence', 'suggestions'], {
  summary: usefulString,
  strengths: nonEmptyStrings,
  concerns: nonEmptyStrings,
  evidence: { type: 'array', minItems: 1, items: evidence },
  suggestions: { type: 'array', minItems: 1, items: usefulString },
});
const scoredAnalysis = {
  synopsis: usefulString,
  scoreByCriterion: scoreMap,
  critique,
} as const;

export const screenplayAnalysisSchema = {
  $id: 'https://schemas.gorenku.com/studio/screenplay-analysis.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...closed(
    ['structureModel', 'title', 'summary', 'criteria', 'actSegments', 'keyBeats', 'sceneAnalyses', 'suggestedScenes'],
    {
      structureModel: { const: 'threeAct' },
      title: nonEmptyString,
      summary: usefulString,
      criteria: {
        type: 'array', minItems: 3, items: closed(['key', 'label', 'description'], {
          key: { type: 'string', pattern: '^[a-z][A-Za-z0-9]*$' },
          label: nonEmptyString,
          description: usefulString,
        }),
      },
      actSegments: {
        type: 'array', minItems: 3, maxItems: 3, items: closed(
          ['role', 'title', 'synopsis', 'sceneIds', 'scoreByCriterion', 'critique'],
          {
            role: { enum: ['actOne', 'actTwo', 'actThree'] },
            title: nonEmptyString,
            sceneIds,
            ...scoredAnalysis,
          },
        ),
      },
      keyBeats: {
        type: 'array', minItems: 9, maxItems: 9, items: closed(
          ['key', 'label', 'synopsis', 'scoreByCriterion', 'critique'],
          { key: beatRole, label: nonEmptyString, sceneId: nonEmptyString, ...scoredAnalysis },
        ),
      },
      sceneGroups: {
        type: 'array', minItems: 1, items: closed(
          ['title', 'synopsis', 'sceneIds', 'scoreByCriterion', 'critique'],
          { title: nonEmptyString, sceneIds, beatRole, ...scoredAnalysis },
        ),
      },
      sceneAnalyses: {
        type: 'array', minItems: 1, items: closed(
          ['sceneId', 'synopsis', 'scoreByCriterion', 'critique'],
          { sceneId: nonEmptyString, beatRole, ...scoredAnalysis },
        ),
      },
      suggestedScenes: {
        type: 'array', items: closed(
          ['placement', 'title', 'purpose', 'synopsis', 'rationale'],
          {
            placement: {
              oneOf: [
                closed(['beforeSceneId'], { beforeSceneId: nonEmptyString }),
                closed(['afterSceneId'], { afterSceneId: nonEmptyString }),
              ],
            },
            title: nonEmptyString,
            purpose: usefulString,
            synopsis: usefulString,
            rationale: usefulString,
            expectedCriterionChanges: {
              type: 'array', minItems: 1, items: closed(
                ['criterionKey', 'direction', 'reason'],
                {
                  criterionKey: nonEmptyString,
                  direction: { enum: ['increase', 'decrease', 'clarify'] },
                  reason: usefulString,
                },
              ),
            },
          },
        ),
      },
    },
  ),
} as const;

function closed<
  TRequired extends readonly string[],
  TProperties extends Record<string, unknown>,
>(required: TRequired, properties: TProperties) {
  return { type: 'object', required, properties, additionalProperties: false } as const;
}
