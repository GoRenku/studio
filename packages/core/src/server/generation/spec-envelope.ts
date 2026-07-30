import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationSpec } from '../../client/generation.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import type { GenerationPurposeContract } from './purpose-contract.js';

export function validateGenerationSpecEnvelope(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
}): DiagnosticIssue[] {
  const diagnostics: DiagnosticIssue[] = [];
  if (input.spec.executionKind !== 'renku-managed' && input.spec.executionKind !== 'agent-external') {
    diagnostics.push(issue('CORE_GENERATION_EXECUTION_INVALID', 'Generation spec executionKind must be renku-managed or agent-external.', ['executionKind']));
  }
  if (input.spec.purpose !== input.purpose.purpose) {
    diagnostics.push(issue('CORE_GENERATION_PURPOSE_INVALID', `Generation spec purpose ${input.spec.purpose} does not match ${input.purpose.purpose}.`, ['purpose']));
  }
  if (input.spec.target.kind !== input.purpose.targetKind) {
    diagnostics.push(issue('CORE_GENERATION_TARGET_INVALID', `Generation purpose ${input.purpose.purpose} requires target kind ${input.purpose.targetKind}, received ${input.spec.target.kind}.`, ['target', 'kind']));
  }
  validateJsonRecord(input.spec.values, ['values'], diagnostics);
  validateAuthoredFrom(input.spec, diagnostics);
  validateShotPlanVideoEnvelope(input.spec, diagnostics);
  validateModel(input.spec, diagnostics);
  validateReferences(input.spec, diagnostics);
  return diagnostics;
}

const SHOT_PLAN_AUTHORED_PURPOSES = new Set<GenerationSpec['purpose']>([
  'shot-plan.video-generation',
  'shot-plan.video-first-frame',
  'shot-plan.video-last-frame',
  'shot-plan.video-storyboard',
]);

function validateShotPlanVideoEnvelope(
  spec: GenerationSpec,
  diagnostics: DiagnosticIssue[]
): void {
  if (SHOT_PLAN_AUTHORED_PURPOSES.has(spec.purpose) && !spec.authoredFrom?.id.trim()) {
    diagnostics.push(issue(
      'CORE_SHOT_PLAN_VIDEO_AUTHORED_SOURCE_REQUIRED',
      `Generation purpose ${spec.purpose} requires a non-empty authored Shot Plan source.`,
      ['authoredFrom']
    ));
  }
  if (spec.purpose === 'shot-plan.video-generation') {
    if (
      spec.shotPlanVideoInputMode !== 'text-only' &&
      spec.shotPlanVideoInputMode !== 'first-frame' &&
      spec.shotPlanVideoInputMode !== 'first-last-frame' &&
      spec.shotPlanVideoInputMode !== 'reference'
    ) {
      diagnostics.push(issue(
        'CORE_SHOT_PLAN_VIDEO_INPUT_MODE_REQUIRED',
        'Shot Plan video generation requires an explicit supported input mode.',
        ['shotPlanVideoInputMode']
      ));
    }
    return;
  }
  if (spec.shotPlanVideoInputMode !== undefined) {
    diagnostics.push(issue(
      'CORE_SHOT_PLAN_VIDEO_INPUT_MODE_FORBIDDEN',
      `Generation purpose ${spec.purpose} does not accept a Shot Plan video input mode.`,
      ['shotPlanVideoInputMode']
    ));
  }
}

function validateAuthoredFrom(
  spec: GenerationSpec,
  diagnostics: DiagnosticIssue[]
): void {
  if (spec.authoredFrom === undefined) {
    return;
  }
  if (
    spec.authoredFrom.kind !== 'shotPlan' ||
    typeof spec.authoredFrom.id !== 'string' ||
    !spec.authoredFrom.id.trim()
  ) {
    diagnostics.push(issue(
      'CORE_GENERATION_SPEC_INVALID',
      'Generation authoredFrom must identify a non-empty Shot Plan id.',
      ['authoredFrom']
    ));
  }
}

function validateModel(spec: GenerationSpec, diagnostics: DiagnosticIssue[]): void {
  for (const field of ['provider', 'model'] as const) {
    const value = spec.model?.[field];
    if (value !== undefined && !value.trim()) {
      diagnostics.push(issue('CORE_GENERATION_MODEL_INVALID', `Generation model ${field} must be omitted or non-empty.`, ['model', field]));
    }
  }
}

function validateReferences(spec: GenerationSpec, diagnostics: DiagnosticIssue[]): void {
  const references = spec.references;
  const slotSelections = new Map<string, number>();
  const promptMentions = new Map<string, number>();
  let largestStudioMention = 0;
  references.forEach((selection, index) => {
    const path = ['references', String(index)];
    if (selection.providerField !== undefined && !selection.providerField.trim()) {
      diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation reference providerField must be omitted or non-empty.', [...path, 'providerField']));
    }
    if (selection.promptMention !== undefined) {
      const mention = selection.promptMention.trim();
      if (!mention) {
        diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation reference promptMention must be omitted or non-empty.', [...path, 'promptMention']));
      } else {
        const count = (promptMentions.get(mention) ?? 0) + 1;
        promptMentions.set(mention, count);
        if (count > 1) {
          diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', `Generation reference promptMention ${mention} must be unique.`, [...path, 'promptMention']));
        }
        const match = /^@Reference([1-9]\d*)$/.exec(mention);
        if (match) {
          largestStudioMention = Math.max(largestStudioMention, Number(match[1]));
        }
      }
    }
    if (selection.reference.kind === 'asset-file') {
      if (!selection.reference.assetId.trim() || !selection.reference.assetFileId.trim()) {
        diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation asset-file references require exact non-empty asset and file ids.', [...path, 'reference']));
      }
    } else {
      try {
        const normalized = normalizeProjectRelativePath(selection.reference.projectRelativePath);
        if (normalized !== selection.reference.projectRelativePath) {
          diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation project-file references must already use normalized project-relative paths.', [...path, 'reference', 'projectRelativePath']));
        }
      } catch {
        diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation project-file references must use a safe normalized project-relative path.', [...path, 'reference', 'projectRelativePath']));
      }
    }
    if (selection.placement.kind !== 'slot') {
      return;
    }
    const placement = selection.placement;
    if (!placement.sectionId.trim() || !placement.slotId.trim() ||
        (placement.subject && (!placement.subject.kind.trim() || !placement.subject.id.trim()))) {
      diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation reference slot placement must identify a non-empty section, slot, and optional subject.', [...path, 'placement']));
    }
    const key = [placement.sectionId, placement.slotId, placement.subject?.kind ?? '', placement.subject?.id ?? ''].join('\0');
    const count = (slotSelections.get(key) ?? 0) + 1;
    slotSelections.set(key, count);
    if (count > 1) {
      diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', `Generation reference slot ${placement.sectionId}/${placement.slotId} accepts one current selection.`, [...path, 'placement']));
    }
  });
  if (spec.nextPromptMentionNumber !== undefined &&
      (!Number.isInteger(spec.nextPromptMentionNumber) ||
       spec.nextPromptMentionNumber <= largestStudioMention)) {
    diagnostics.push(issue(
      'CORE_GENERATION_SELECTION_INVALID',
      'Generation nextPromptMentionNumber must be a positive integer greater than every allocated Studio reference mention.',
      ['nextPromptMentionNumber'],
    ));
  }
}

function validateJsonRecord(value: unknown, path: string[], diagnostics: DiagnosticIssue[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(issue('CORE_GENERATION_SPEC_INVALID', `Generation spec field ${path.join('.')} must be a JSON object.`, path));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    validateJsonValue(child, [...path, key], diagnostics);
  }
}

function validateJsonValue(value: unknown, path: string[], diagnostics: DiagnosticIssue[]): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => validateJsonValue(child, [...path, String(index)], diagnostics));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => validateJsonValue(child, [...path, key], diagnostics));
    return;
  }
  diagnostics.push(issue('CORE_GENERATION_SPEC_INVALID', `Generation spec field ${path.join('.')} must be a JSON value.`, path));
}

function issue(code: string, message: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(code, message, { path });
}
