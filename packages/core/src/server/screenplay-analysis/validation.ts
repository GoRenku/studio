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
  screenplayAnalysisSchema,
  type ScreenplayAnalysis,
  type ScreenplayAnalysisCritique,
} from '../../client/screenplay-analysis/index.js';
import type { Screenplay } from '../../client/screenplay/index.js';

const CODE = 'PROJECT_DATA330';
const BEAT_ROLES = ['hook', 'incitingIncident', 'firstPlotPoint', 'firstPinchPoint', 'midpoint', 'secondPinchPoint', 'secondPlotPoint', 'climax', 'resolution'] as const;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
ajv.addSchema(screenplayAnalysisSchema);

export function parseScreenplayAnalysis(input: { contents: string; filePath?: string }): ScreenplayAnalysis {
  let value: unknown;
  try {
    value = JSON.parse(input.contents);
  } catch {
    invalid([issue('Input must be a valid JSON object.', [], input.filePath)]);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid([issue('Input must be a valid JSON object.', [], input.filePath)]);
  }
  return value as ScreenplayAnalysis;
}

export function validateScreenplayAnalysis(input: {
  analysis: ScreenplayAnalysis;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticResult {
  const shapeIssues = validateShape(input.analysis, input.filePath);
  return buildDiagnosticResult(shapeIssues.length > 0 ? shapeIssues : validateSemantics(input));
}

export function assertScreenplayAnalysis(input: {
  analysis: ScreenplayAnalysis;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticIssue[] {
  const result = validateScreenplayAnalysis(input);
  throwIfDiagnosticResultInvalid(result, {
    code: CODE,
    message: 'Screenplay Analysis JSON failed validation.',
    suggestion: 'Fix the reported Screenplay Analysis issues and run the command again.',
  });
  return result.warnings;
}

export function parseStoredScreenplayAnalysis(input: {
  value: string;
  path?: string[];
}): ScreenplayAnalysis {
  let analysis: ScreenplayAnalysis;
  try {
    analysis = JSON.parse(input.value) as ScreenplayAnalysis;
  } catch {
    invalid([issue('Stored Screenplay Analysis must be valid JSON.', input.path ?? ['screenplayAnalysis', 'document'])]);
  }
  const result = buildDiagnosticResult(validateShape(analysis));
  throwIfDiagnosticResultInvalid(result, {
    code: CODE,
    message: 'Stored Screenplay Analysis JSON failed validation.',
    suggestion: 'Repair the stored Screenplay Analysis JSON.',
  });
  return analysis;
}

export function serializeScreenplayAnalysis(input: {
  analysis: ScreenplayAnalysis;
  screenplay: Screenplay;
  filePath?: string;
}): string {
  assertScreenplayAnalysis(input);
  return JSON.stringify(input.analysis);
}

function validateShape(value: unknown, filePath?: string): DiagnosticIssue[] {
  const validator = ajv.getSchema(screenplayAnalysisSchema.$id);
  if (!validator) {
    return [issue('Screenplay Analysis schema is unavailable.', [], filePath)];
  }
  return validator(value) ? [] : mapAjvErrors(validator.errors ?? [], filePath);
}

function validateSemantics(input: {
  analysis: ScreenplayAnalysis;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticIssue[] {
  const { analysis, screenplay, filePath } = input;
  const issues: DiagnosticIssue[] = [];
  const orderedSceneIds = screenplay.scenes.map((scene) => scene.id);
  const sceneIds = new Set(orderedSceneIds);
  const criterionKeys = analysis.criteria.map((criterion) => criterion.key);
  requireUnique(criterionKeys, ['criteria'], 'criterion key', issues, filePath);
  for (const criterion of DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA) {
    if (!criterionKeys.includes(criterion.key)) {
      issues.push(issue(`Default criterion is required: ${criterion.key}.`, ['criteria'], filePath));
    }
  }
  const scoreOwners: Array<{ path: string[]; scores: Record<string, number>; critique: ScreenplayAnalysisCritique }> = [];
  const expectedRoles = ['actOne', 'actTwo', 'actThree'];
  analysis.actSegments.forEach((segment, index) => {
    if (segment.role !== expectedRoles[index]) {
      issues.push(issue(`Act segment ${index + 1} must use role ${expectedRoles[index]}.`, ['actSegments', String(index), 'role'], filePath));
    }
    validateSceneIds(segment.sceneIds, sceneIds, ['actSegments', String(index), 'sceneIds'], issues, filePath);
    scoreOwners.push({ path: ['actSegments', String(index)], scores: segment.scoreByCriterion, critique: segment.critique });
  });
  requireExactOrder(analysis.actSegments.flatMap((segment) => segment.sceneIds), orderedSceneIds, ['actSegments'], issues, filePath, 'Act segments');
  requireUnique(analysis.keyBeats.map((beat) => beat.key), ['keyBeats'], 'key beat', issues, filePath);
  for (const role of BEAT_ROLES) {
    if (!analysis.keyBeats.some((beat) => beat.key === role)) {
      issues.push(issue(`Key beat is required: ${role}.`, ['keyBeats'], filePath));
    }
  }
  analysis.keyBeats.forEach((beat, index) => {
    if (beat.sceneId && !sceneIds.has(beat.sceneId)) {
      issues.push(unknownScene(['keyBeats', String(index), 'sceneId'], filePath));
    }
    scoreOwners.push({ path: ['keyBeats', String(index)], scores: beat.scoreByCriterion, critique: beat.critique });
  });
  requireExactOrder(analysis.sceneAnalyses.map((entry) => entry.sceneId), orderedSceneIds, ['sceneAnalyses'], issues, filePath, 'Scene analyses');
  analysis.sceneAnalyses.forEach((entry, index) => scoreOwners.push({ path: ['sceneAnalyses', String(index)], scores: entry.scoreByCriterion, critique: entry.critique }));
  if (analysis.sceneGroups) {
    analysis.sceneGroups.forEach((group, index) => {
      validateSceneIds(group.sceneIds, sceneIds, ['sceneGroups', String(index), 'sceneIds'], issues, filePath);
      scoreOwners.push({ path: ['sceneGroups', String(index)], scores: group.scoreByCriterion, critique: group.critique });
    });
    requireExactOrder(analysis.sceneGroups.flatMap((group) => group.sceneIds), orderedSceneIds, ['sceneGroups'], issues, filePath, 'Scene groups');
  }
  for (const owner of scoreOwners) {
    const keys = Object.keys(owner.scores).sort();
    const expected = [...criterionKeys].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      issues.push(issue('Score map must contain every declared criterion and no undeclared criterion.', [...owner.path, 'scoreByCriterion'], filePath));
    }
    owner.critique.evidence.forEach((evidence, index) => {
      if (evidence.sceneId && !sceneIds.has(evidence.sceneId)) {
        issues.push(unknownScene([...owner.path, 'critique', 'evidence', String(index), 'sceneId'], filePath));
      }
    });
  }
  analysis.suggestedScenes.forEach((suggestion, index) => {
    const anchor = 'beforeSceneId' in suggestion.placement ? suggestion.placement.beforeSceneId : suggestion.placement.afterSceneId;
    if (!anchor || !sceneIds.has(anchor)) {
      issues.push(unknownScene(['suggestedScenes', String(index), 'placement'], filePath));
    }
    suggestion.expectedCriterionChanges?.forEach((change, changeIndex) => {
      if (!criterionKeys.includes(change.criterionKey)) {
        issues.push(issue('Suggested criterion change references an undeclared criterion.', ['suggestedScenes', String(index), 'expectedCriterionChanges', String(changeIndex), 'criterionKey'], filePath));
      }
    });
  });
  return issues;
}

function validateSceneIds(values: string[], sceneIds: Set<string>, path: string[], issues: DiagnosticIssue[], filePath?: string): void {
  requireUnique(values, path, 'Scene id', issues, filePath);
  values.forEach((value, index) => {
    if (!sceneIds.has(value)) {
      issues.push(unknownScene([...path, String(index)], filePath));
    }
  });
}

function requireExactOrder(actual: string[], expected: string[], path: string[], issues: DiagnosticIssue[], filePath: string | undefined, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push(issue(`${label} must partition every current Scene exactly once in canonical order.`, path, filePath));
  }
}

function requireUnique(values: string[], path: string[], label: string, issues: DiagnosticIssue[], filePath?: string): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      issues.push(issue(`Duplicate ${label}: ${value}.`, [...path, String(index)], filePath));
    }
    seen.add(value);
  });
}

function unknownScene(path: string[], filePath?: string): DiagnosticIssue {
  return issue('Screenplay Analysis references an unknown Scene.', path, filePath);
}

function mapAjvErrors(errors: ErrorObject[], filePath?: string): DiagnosticIssue[] {
  return errors.map((error) => {
    const path = error.instancePath.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (error.keyword === 'required') {
      path.push(String(error.params.missingProperty));
    }
    if (error.keyword === 'additionalProperties') {
      path.push(String(error.params.additionalProperty));
    }
    return issue(`Invalid Screenplay Analysis value at ${path.join('.') || '<root>'}.`, path, filePath);
  });
}

function issue(message: string, path: string[], filePath?: string): DiagnosticIssue {
  return createDiagnosticError(CODE, message, { path, ...(filePath ? { filePath } : {}) }, 'Use the current Screenplay Analysis contract and current Scene IDs.');
}

function invalid(issues: DiagnosticIssue[]): never {
  throwIfDiagnosticResultInvalid(buildDiagnosticResult(issues), {
    code: CODE,
    message: 'Screenplay Analysis JSON failed validation.',
    suggestion: 'Provide a valid Screenplay Analysis JSON object.',
  });
  throw new Error('unreachable');
}
