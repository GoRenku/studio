import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationReferenceSelection, GenerationSpec } from '../../client/generation.js';
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
  validateModel(input.spec, diagnostics);
  validateReferences(input.spec.references, diagnostics);
  return diagnostics;
}

function validateModel(spec: GenerationSpec, diagnostics: DiagnosticIssue[]): void {
  for (const field of ['provider', 'model'] as const) {
    const value = spec.model?.[field];
    if (value !== undefined && !value.trim()) {
      diagnostics.push(issue('CORE_GENERATION_MODEL_INVALID', `Generation model ${field} must be omitted or non-empty.`, ['model', field]));
    }
  }
}

function validateReferences(references: GenerationReferenceSelection[], diagnostics: DiagnosticIssue[]): void {
  const slotSelections = new Map<string, number>();
  references.forEach((selection, index) => {
    const path = ['references', String(index)];
    if (selection.providerField !== undefined && !selection.providerField.trim()) {
      diagnostics.push(issue('CORE_GENERATION_SELECTION_INVALID', 'Generation reference providerField must be omitted or non-empty.', [...path, 'providerField']));
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
