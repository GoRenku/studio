import { assertSafeMediaGenerationRequest } from '@gorenku/studio-core/server';
import type { JsonValue } from '@gorenku/studio-core/client';
import type { GenerationReviewControls, GenerationReviewDraft, GenerationReviewField, GenerationReviewRequest } from './client.js';
import { reviewError } from './diagnostics.js';

export function validateReviewControls(controls: GenerationReviewControls): void {
  const keys = new Set<string>();
  for (const group of controls.groups) {
    for (const control of group.fields) {
      if (!/^(?:\/(?:[^~/]|~[01])*)+$/.test(control.key)) throw reviewError('CODEX_REVIEW_INVALID', 'Controls must identify their native request fields with exact JSON pointers.');
      if (keys.has(control.key)) throw reviewError('CODEX_REVIEW_INVALID', `Duplicate control key: ${control.key}.`);
      keys.add(control.key);
      validateFieldDescription(control);
      validateFieldValue(control, control.initialValue);
    }
  }
}

function validateFieldDescription(control: GenerationReviewField, depth = 0, nativePointer = control.key): void {
  if (depth > 16) throw reviewError('CODEX_REVIEW_INVALID', 'Control nesting exceeds the presentation limit.');
  assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, null), 'review');
  if (control.minimum !== undefined && control.maximum !== undefined && control.minimum > control.maximum) {
    throw reviewError('CODEX_REVIEW_INVALID', `Invalid bounds for ${control.label}.`);
  }
  if (['enum', 'multi-enum'].includes(control.kind) && !control.options?.length) {
    throw reviewError('CODEX_REVIEW_INVALID', `Schema-backed choices are required for ${control.label}.`);
  }
  if (control.initialValue !== undefined) assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, control.initialValue), 'review');
  for (const option of control.options ?? []) assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, option.value), 'review');
  if (control.kind === 'object' && !control.properties) throw reviewError('CODEX_REVIEW_INVALID', `Object properties are required for ${control.label}.`);
  if (control.kind === 'array' && !control.element) throw reviewError('CODEX_REVIEW_INVALID', `Array element controls are required for ${control.label}.`);
  const nestedKeys = new Set<string>();
  for (const property of control.properties ?? []) {
    if (nestedKeys.has(property.key)) throw reviewError('CODEX_REVIEW_INVALID', `Duplicate object property: ${property.key}.`);
    nestedKeys.add(property.key);
    validateFieldDescription(property, depth + 1, nativePropertyPointer(nativePointer, property.key));
  }
  if (control.element) validateFieldDescription(control.element, depth + 1, `${nativePointer}/0`);
}

export function validateReviewDrafts(requests: GenerationReviewRequest[], drafts: GenerationReviewDraft[]): void {
  validateReviewDraftIdentities(requests, drafts);
  requests.forEach((request, index) => {
    const draft = drafts[index]!;
    if (!request.preview.editable && draft.prompt !== request.preview.prompt) throw reviewError('CODEX_REVIEW_INVALID', 'This request does not allow prompt editing.');
    request.controls.groups.flatMap((group) => group.fields).forEach((control) => validateFieldValue(control, draft.values[control.key]));
  });
}

export function validateReviewDraftIdentities(requests: GenerationReviewRequest[], drafts: GenerationReviewDraft[]): void {
  if (drafts.length !== requests.length || new Set(drafts.map((draft) => draft.requestId)).size !== drafts.length) {
    throw reviewError('CODEX_REVIEW_INVALID', 'Submit one draft for each declared request, in the review order.');
  }
  requests.forEach((request, index) => {
    const draft = drafts[index]!;
    if (draft.requestId !== request.requestId) throw reviewError('CODEX_REVIEW_INVALID', 'Draft request identities or order do not match the review.');
    const declared = request.controls.groups.flatMap((group) => group.fields);
    if (Object.keys(draft.values).some((key) => !declared.some((control) => control.key === key))) {
      throw reviewError('CODEX_REVIEW_INVALID', 'Only declared native controls may be submitted.');
    }
  });
}

export function initialReviewDraft(request: GenerationReviewRequest): GenerationReviewDraft {
  return {
    requestId: request.requestId, prompt: request.preview.prompt,
    values: Object.fromEntries(request.controls.groups.flatMap((group) => group.fields)
      .filter((control) => control.initialValue !== undefined)
      .map((control) => [control.key, control.initialValue!])),
  };
}

export function validateFieldValue(control: GenerationReviewField, value: JsonValue | undefined, nativePointer = control.key): void {
  if (value === undefined) {
    if (control.required) throw reviewError('CODEX_REVIEW_INVALID', `${control.label} is required.`);
    return;
  }
  if (value === null && control.nullable) return;
  const validator = valueValidators[control.kind];
  if (!validator(control, value, nativePointer)) throw reviewError('CODEX_REVIEW_INVALID', `Invalid value for ${control.label}.`);
  assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, value), 'review');
}

const valueValidators: Record<GenerationReviewField['kind'], (field: GenerationReviewField, value: JsonValue, nativePointer: string) => boolean> = {
  text: (_field, value) => typeof value === 'string',
  multiline: (_field, value) => typeof value === 'string',
  boolean: (_field, value) => typeof value === 'boolean',
  number: validateNumber,
  integer: (field, value) => Number.isInteger(value) && validateNumber(field, value),
  enum: (field, value) => field.options!.some((option) => JSON.stringify(option.value) === JSON.stringify(value)),
  'multi-enum': (field, value, nativePointer) => Array.isArray(value) && value.every((entry) => valueValidators.enum(field, entry, nativePointer)),
  object: (field, value, nativePointer) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.keys(value).some((key) => !field.properties!.some((property) => property.key === key))) return false;
    field.properties!.forEach((property) => validateFieldValue(property, value[property.key], nativePropertyPointer(nativePointer, property.key)));
    return true;
  },
  array: (field, value, nativePointer) => {
    if (!Array.isArray(value)) return false;
    value.forEach((entry, index) => validateFieldValue(field.element!, entry, `${nativePointer}/${index}`));
    return true;
  },
};

function nativePropertyPointer(parent: string, key: string): string {
  return `${parent}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

function nativeControlEnvelope(pointer: string, value: JsonValue): JsonValue {
  return pointer.split('/').slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduceRight<JsonValue>((request, segment) => ({ [segment]: request }), value);
}

function validateNumber(field: GenerationReviewField, value: JsonValue): boolean {
  return typeof value === 'number' && Number.isFinite(value)
    && (field.minimum === undefined || value >= field.minimum)
    && (field.maximum === undefined || value <= field.maximum);
}
