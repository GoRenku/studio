import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
  type DiagnosticResult,
} from '@gorenku/studio-diagnostics';
import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
  type ScreenplayAnalysisDocument,
  type ScreenplayAnalysisScoreMap,
} from '../../client/screenplay-analysis.js';
import { screenplayAnalysisDocumentSchema } from '../../client/screenplay-analysis-json-schemas.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(screenplayAnalysisDocumentSchema);

export function parseScreenplayAnalysisDocument(input: {
  contents: string;
  filePath?: string;
}): ScreenplayAnalysisDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.contents);
  } catch {
    throwInvalidAnalysisJson(input.filePath);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throwInvalidAnalysisJson(input.filePath);
  }
  return parsed as ScreenplayAnalysisDocument;
}

export function validateScreenplayAnalysisDocument(input: {
  document: ScreenplayAnalysisDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticResult {
  const shapeIssues = validateScreenplayAnalysisShape(input.document, input.filePath);
  const issues = shapeIssues.length > 0
    ? shapeIssues
    : [...shapeIssues, ...validateScreenplayAnalysisSemantics(input)];
  return buildDiagnosticResult(issues);
}

export function assertScreenplayAnalysisDocument(input: {
  document: ScreenplayAnalysisDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const result = validateScreenplayAnalysisDocument(input);
  throwIfDiagnosticResultInvalid(result, {
    code: 'PROJECT_DATA260',
    message: 'Screenplay Analysis JSON failed validation.',
    suggestion: 'Fix the reported screenplay analysis issues and run the command again.',
  });
  return result.warnings;
}

export function parseStoredScreenplayAnalysisDocument(input: {
  value: string;
  screenplay: ScreenplayDocument;
  path?: string[];
}): ScreenplayAnalysisDocument {
  let parsed: ScreenplayAnalysisDocument;
  try {
    parsed = JSON.parse(input.value) as ScreenplayAnalysisDocument;
  } catch {
    throwIfDiagnosticResultInvalid(
      buildDiagnosticResult([
        createDiagnosticError(
          'PROJECT_DATA201',
          'Stored Screenplay Analysis document must be valid JSON.',
          { path: input.path ?? ['screenplayAnalysis', 'document'] },
          'Repair the stored Screenplay Analysis JSON.'
        ),
      ]),
      {
        code: 'PROJECT_DATA201',
        message: 'Stored Screenplay Analysis JSON failed validation.',
        suggestion: 'Repair the stored Screenplay Analysis JSON.',
      }
    );
    throw new Error('unreachable');
  }
  const result = validateScreenplayAnalysisDocument({
    document: parsed,
    screenplay: input.screenplay,
  });
  throwIfDiagnosticResultInvalid(result, {
    code: 'PROJECT_DATA260',
    message: 'Stored Screenplay Analysis JSON failed validation.',
    suggestion: 'Repair the stored Screenplay Analysis JSON.',
  });
  return parsed;
}

export function serializeScreenplayAnalysisDocument(input: {
  document: ScreenplayAnalysisDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): string {
  assertScreenplayAnalysisDocument(input);
  return JSON.stringify(input.document);
}

function validateScreenplayAnalysisShape(
  document: unknown,
  filePath?: string
): DiagnosticIssue[] {
  const validator = ajv.getSchema(screenplayAnalysisDocumentSchema.$id);
  if (!validator) {
    throw new Error('Screenplay Analysis JSON schema was not registered.');
  }
  const valid = validator(document);
  return valid ? [] : mapAjvErrors(validator.errors ?? [], filePath);
}

function validateScreenplayAnalysisSemantics(input: {
  document: ScreenplayAnalysisDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const { document, screenplay, filePath } = input;
  if (!document || typeof document !== 'object') {
    return [];
  }

  const issues: DiagnosticIssue[] = [];
  const criterionKeys = new Set<string>();
  document.criteria?.forEach((criterion, index) => {
    const key = criterion.key;
    if (criterionKeys.has(key)) {
      issues.push(error('Duplicate analysis criterion key.', ['criteria', String(index), 'key'], filePath, 'Use each criterion key only once.'));
    }
    criterionKeys.add(key);
  });

  for (const criterion of DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA) {
    if (!criterionKeys.has(criterion.key)) {
      issues.push(
        error(
          `Default criterion is required: ${criterion.key}.`,
          ['criteria'],
          filePath,
          'Include dramaticEnergy, stakes, and characterAgency in criteria.'
        )
      );
    }
  }

  const graph = buildScreenplayGraph(screenplay);
  validateActs(document, graph, issues, filePath);

  document.acts?.forEach((act, index) => {
    validateScoreKeys(act.scoreByCriterion, criterionKeys, ['acts', String(index), 'scoreByCriterion'], issues, filePath);
    validateCritique(
      act.critique,
      { graph, actId: act.actId },
      ['acts', String(index), 'critique'],
      issues,
      filePath
    );
  });
  document.keyBeats?.forEach((beat, index) => {
    const path = ['keyBeats', String(index)];
    validateActReference(beat.actId, graph, [...path, 'actId'], issues, filePath);
    if (beat.sequenceId) {
      validateSequenceReference(beat.sequenceId, beat.actId, graph, [...path, 'sequenceId'], issues, filePath);
    }
    if (beat.sceneId) {
      validateSceneReference(beat.sceneId, beat.sequenceId, beat.actId, graph, [...path, 'sceneId'], issues, filePath);
    }
    validateScoreKeys(beat.scoreByCriterion, criterionKeys, [...path, 'scoreByCriterion'], issues, filePath);
    validateCritique(
      beat.critique,
      { graph, actId: beat.actId, sequenceId: beat.sequenceId },
      [...path, 'critique'],
      issues,
      filePath
    );
  });
  document.sequences?.forEach((sequence, index) => {
    const path = ['sequences', String(index)];
    validateSequenceReference(sequence.sequenceId, sequence.actId, graph, [...path, 'sequenceId'], issues, filePath);
    validateScoreKeys(sequence.scoreByCriterion, criterionKeys, [...path, 'scoreByCriterion'], issues, filePath);
    validateCritique(
      sequence.critique,
      { graph, actId: sequence.actId, sequenceId: sequence.sequenceId },
      [...path, 'critique'],
      issues,
      filePath
    );
  });
  document.scenes?.forEach((scene, index) => {
    const path = ['scenes', String(index)];
    validateSceneReference(scene.sceneId, scene.sequenceId, scene.actId, graph, [...path, 'sceneId'], issues, filePath);
    validateScoreKeys(scene.scoreByCriterion, criterionKeys, [...path, 'scoreByCriterion'], issues, filePath);
    validateCritique(
      scene.critique,
      { graph, actId: scene.actId, sequenceId: scene.sequenceId },
      [...path, 'critique'],
      issues,
      filePath
    );
  });
  document.suggestedSceneAdditions?.forEach((addition, index) => {
    const path = ['suggestedSceneAdditions', String(index)];
    validateActReference(addition.targetActId, graph, [...path, 'targetActId'], issues, filePath);
    if (addition.targetSequenceId) {
      validateSequenceReference(addition.targetSequenceId, addition.targetActId, graph, [...path, 'targetSequenceId'], issues, filePath);
    }
    const placementSceneIds = [
      addition.placement?.beforeSceneId,
      addition.placement?.afterSceneId,
    ].filter(Boolean) as string[];
    if (placementSceneIds.length > 1) {
      issues.push(error('Suggested scene placement can use beforeSceneId or afterSceneId, not both.', [...path, 'placement'], filePath, 'Choose one placement anchor.'));
    }
    if (placementSceneIds.length > 0 && !addition.targetSequenceId) {
      issues.push(error('Suggested scene placement requires targetSequenceId.', [...path, 'targetSequenceId'], filePath, 'Set the target sequence before anchoring placement to a scene.'));
    }
    for (const sceneId of placementSceneIds) {
      validateSceneReference(sceneId, addition.targetSequenceId, addition.targetActId, graph, [...path, 'placement'], issues, filePath);
    }
    addition.expectedCriterionChanges?.forEach((change, changeIndex) => {
      if (!criterionKeys.has(change.criterionKey)) {
        issues.push(error('Criterion change references an undeclared criterion.', [...path, 'expectedCriterionChanges', String(changeIndex), 'criterionKey'], filePath, 'Use a key declared in criteria.'));
      }
    });
  });

  return issues;
}

function validateActs(
  document: ScreenplayAnalysisDocument,
  graph: ScreenplayGraph,
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  if (document.structureModel !== 'threeAct') {
    issues.push(error('Only the threeAct structure model is supported.', ['structureModel'], filePath, 'Use structureModel: "threeAct".'));
    return;
  }
  if (graph.actOrder.length !== 3) {
    issues.push(error('Three-act analysis requires exactly three screenplay acts.', ['acts'], filePath, 'Create exactly three acts before writing a three-act analysis.'));
  }
  if (document.acts.length !== 3) {
    issues.push(error('Three-act analysis must contain exactly three act analyses.', ['acts'], filePath, 'Analyze actOne, actTwo, and actThree in screenplay order.'));
    return;
  }
  const expectedRoles = ['actOne', 'actTwo', 'actThree'];
  document.acts.forEach((act, index) => {
    if (act.actId !== graph.actOrder[index]) {
      issues.push(error('Act analysis order must match screenplay act order.', ['acts', String(index), 'actId'], filePath, 'List the current screenplay acts in order.'));
    }
    if (act.actRole !== expectedRoles[index]) {
      issues.push(error('Act role does not match the three-act position.', ['acts', String(index), 'actRole'], filePath, `Use ${expectedRoles[index]} for this act position.`));
    }
    validateActReference(act.actId, graph, ['acts', String(index), 'actId'], issues, filePath);
  });
}

function validateScoreKeys(
  scoreByCriterion: ScreenplayAnalysisScoreMap,
  criterionKeys: Set<string>,
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  for (const [key, value] of Object.entries(scoreByCriterion ?? {})) {
    if (!criterionKeys.has(key)) {
      issues.push(error('Score references an undeclared criterion.', [...path, key], filePath, 'Use a key declared in criteria.'));
    }
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      issues.push(error('Score must be an integer from 0 to 100.', [...path, key], filePath, 'Use an integer score from 0 to 100.'));
    }
  }
}

function validateCritique(
  critique: ScreenplayAnalysisDocument['acts'][number]['critique'],
  context: {
    graph: ScreenplayGraph;
    actId?: string;
    sequenceId?: string;
  },
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  if (!critique) {
    return;
  }
  if (!hasUsefulText(critique.summary)) {
    issues.push(error('Critique summary must be specific enough to be useful.', [...path, 'summary'], filePath, 'Write a sentence that names the story issue or strength.'));
  }
  critique.evidence?.forEach((evidence, index) => {
    if (evidence.sceneId) {
      validateSceneReference(
        evidence.sceneId,
        context.sequenceId,
        context.actId,
        context.graph,
        [...path, 'evidence', String(index), 'sceneId'],
        issues,
        filePath
      );
    }
    if (!hasUsefulText(evidence.text)) {
      issues.push(error('Evidence text must be specific enough to be useful.', [...path, 'evidence', String(index), 'text'], filePath, 'Cite the scene behavior or text that supports the critique.'));
    }
  });
  critique.suggestions?.forEach((suggestion, index) => {
    if (!hasUsefulText(suggestion)) {
      issues.push(error('Suggestion must be specific enough to be useful.', [...path, 'suggestions', String(index)], filePath, 'Give an actionable story adjustment.'));
    }
  });
}

function validateActReference(
  actId: string | undefined,
  graph: ScreenplayGraph,
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  if (actId && !graph.acts.has(actId)) {
    issues.push(error('Analysis references an unknown act.', path, filePath, 'Use an act id from the current screenplay context.'));
  }
}

function validateSequenceReference(
  sequenceId: string | undefined,
  actId: string | undefined,
  graph: ScreenplayGraph,
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const sequence = sequenceId ? graph.sequences.get(sequenceId) : undefined;
  if (!sequence) {
    issues.push(error('Analysis references an unknown sequence.', path, filePath, 'Use a sequence id from the current screenplay context.'));
    return;
  }
  if (actId && sequence.actId !== actId) {
    issues.push(error('Sequence does not belong to the referenced act.', path, filePath, 'Use the sequence id under the stated act.'));
  }
}

function validateSceneReference(
  sceneId: string | undefined,
  sequenceId: string | undefined,
  actId: string | undefined,
  graph: ScreenplayGraph,
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const scene = sceneId ? graph.scenes.get(sceneId) : undefined;
  if (!scene) {
    issues.push(error('Analysis references an unknown scene.', path, filePath, 'Use a scene id from the current screenplay context.'));
    return;
  }
  if (sequenceId && scene.sequenceId !== sequenceId) {
    issues.push(error('Scene does not belong to the referenced sequence.', path, filePath, 'Use the scene id under the stated sequence.'));
  }
  if (actId && scene.actId !== actId) {
    issues.push(error('Scene does not belong to the referenced act.', path, filePath, 'Use the scene id under the stated act.'));
  }
}

interface ScreenplayGraph {
  actOrder: string[];
  acts: Set<string>;
  sequences: Map<string, { actId: string }>;
  scenes: Map<string, { sequenceId: string; actId: string }>;
}

function buildScreenplayGraph(screenplay: ScreenplayDocument): ScreenplayGraph {
  const graph: ScreenplayGraph = {
    actOrder: [],
    acts: new Set<string>(),
    sequences: new Map(),
    scenes: new Map(),
  };
  screenplay.acts.forEach((act) => {
    if (!act.id) {
      return;
    }
    graph.actOrder.push(act.id);
    graph.acts.add(act.id);
    act.sequences.forEach((sequence) => {
      if (!sequence.id) {
        return;
      }
      graph.sequences.set(sequence.id, { actId: act.id as string });
      sequence.scenes.forEach((scene) => {
        if (scene.id) {
          graph.scenes.set(scene.id, {
            sequenceId: sequence.id as string,
            actId: act.id as string,
          });
        }
      });
    });
  });
  return graph;
}

function hasUsefulText(value: string | undefined): boolean {
  return (value ?? '').trim().length >= 12;
}

function throwInvalidAnalysisJson(filePath?: string): never {
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult([
      createDiagnosticError(
        'PROJECT_DATA201',
        'Input must be a valid JSON object.',
        { path: [], ...(filePath ? { filePath } : {}) },
        'Provide a valid JSON object.'
      ),
    ]),
    {
      code: 'PROJECT_DATA201',
      message: 'Input must be a valid JSON object.',
      suggestion: 'Provide a valid JSON object.',
    }
  );
  throw new Error('unreachable');
}

function mapAjvErrors(errors: ErrorObject[], filePath?: string): DiagnosticIssue[] {
  return errors
    .filter((validationError) => validationError.keyword !== 'if')
    .map((validationError) => {
      const path = pointerToPath(validationError.instancePath);
      if (validationError.keyword === 'required') {
        const missing = String(validationError.params.missingProperty);
        return error(`${missing} is required.`, [...path, missing], filePath, `Add the required ${missing} field.`);
      }
      if (validationError.keyword === 'additionalProperties') {
        const field = String(validationError.params.additionalProperty);
        return error(`Unknown field is not allowed: ${field}.`, [...path, field], filePath, 'Remove the field or add it to the Screenplay Analysis contract.');
      }
      if (validationError.keyword === 'const' || validationError.keyword === 'enum') {
        return error(`Unsupported value at ${formatPath(path)}.`, path, filePath, 'Use one of the documented values.');
      }
      return error(`Invalid value at ${formatPath(path)}.`, path, filePath, 'Use the documented type and value range for this field.');
    });
}

function error(
  message: string,
  path: string[],
  filePath?: string,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticError(
    'PROJECT_DATA260',
    message,
    { path, ...(filePath ? { filePath } : {}) },
    suggestion
  );
}

function pointerToPath(pointer: string): string[] {
  if (!pointer) {
    return [];
  }
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function formatPath(path: string[]): string {
  return path.length > 0 ? path.join('.') : '<root>';
}
