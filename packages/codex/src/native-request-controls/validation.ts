import { assertSafeMediaGenerationRequest } from '@gorenku/studio-core/server';
import type { JsonValue } from '@gorenku/studio-core/client';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { NativeRequestControl, NativeRequestControls } from './contracts.js';
import { isJsonPointer, jsonPointerChild, nativeControlEnvelope } from './json-pointer.js';

/** Builds the caller family's issue for a path relative to the caller's controls or values. */
export type NativeRequestIssueFactory = (path: Array<string | number>, message: string) => DiagnosticIssue;

const MAX_NESTING = 16;

export function nativeRequestControlList(controls: NativeRequestControls): NativeRequestControl[] {
  return controls.groups.flatMap((group) => group.fields);
}

/**
 * Structural issues of Skill-authored controls, collected. Unsafe pointers, initial values and
 * choices throw Core's safety error immediately rather than being collected.
 */
export function nativeRequestControlIssues(controls: NativeRequestControls, issue: NativeRequestIssueFactory, path: Array<string | number> = []): DiagnosticIssue[] {
  const keys = new Set<string>();
  return controls.groups.flatMap((group, groupIndex) => group.fields.flatMap((control, index) => {
    const at = [...path, 'groups', groupIndex, 'fields', index];
    if (!isJsonPointer(control.key)) return [issue([...at, 'key'], `${control.label} must identify its native request field with an exact JSON Pointer.`)];
    const duplicate = keys.has(control.key) ? [issue([...at, 'key'], `Duplicate control key: ${control.key}.`)] : [];
    keys.add(control.key);
    const description = controlDescriptionIssues(control, issue, at, 0, control.key);
    const value = description.length === 0 ? nativeRequestValueIssues(control, control.initialValue, issue, [...at, 'initialValue']) : [];
    return [...duplicate, ...description, ...value];
  }));
}

function controlDescriptionIssues(control: NativeRequestControl, issue: NativeRequestIssueFactory, path: Array<string | number>, depth: number, nativePointer: string): DiagnosticIssue[] {
  if (depth > MAX_NESTING) return [issue(path, 'Control nesting exceeds the presentation limit.')];
  assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, null), 'review');
  if (control.initialValue !== undefined) assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, control.initialValue), 'review');
  for (const option of control.options ?? []) assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, option.value), 'review');
  const nestedKeys = new Set<string>();
  return [
    ...(control.minimum !== undefined && control.maximum !== undefined && control.minimum > control.maximum ? [issue(path, `Invalid bounds for ${control.label}.`)] : []),
    ...(['enum', 'multi-enum'].includes(control.kind) && !control.options?.length ? [issue([...path, 'options'], `Schema-backed choices are required for ${control.label}.`)] : []),
    ...(control.kind === 'object' && !control.properties ? [issue([...path, 'properties'], `Object properties are required for ${control.label}.`)] : []),
    ...(control.kind === 'array' && !control.element ? [issue([...path, 'element'], `Array element controls are required for ${control.label}.`)] : []),
    ...(control.properties ?? []).flatMap((property, index) => {
      const duplicate = nestedKeys.has(property.key) ? [issue([...path, 'properties', index, 'key'], `Duplicate object property: ${property.key}.`)] : [];
      nestedKeys.add(property.key);
      return [...duplicate, ...controlDescriptionIssues(property, issue, [...path, 'properties', index], depth + 1, jsonPointerChild(nativePointer, property.key))];
    }),
    ...(control.element ? controlDescriptionIssues(control.element, issue, [...path, 'element'], depth + 1, `${nativePointer}/0`) : []),
  ];
}

/** Issues of one value against its control, collected; unsafe values throw Core's safety error. */
export function nativeRequestValueIssues(
  control: NativeRequestControl,
  value: JsonValue | undefined,
  issue: NativeRequestIssueFactory,
  path: Array<string | number>,
  nativePointer = control.key,
): DiagnosticIssue[] {
  if (value === undefined) return control.required ? [issue(path, `${control.label} is required.`)] : [];
  if (value === null && control.nullable) return [];
  const issues = valueIssues[control.kind](control, value, issue, path, nativePointer);
  if (issues.length === 0) assertSafeMediaGenerationRequest(nativeControlEnvelope(nativePointer, value), 'review');
  return issues;
}

type ValueIssues = (control: NativeRequestControl, value: JsonValue, issue: NativeRequestIssueFactory, path: Array<string | number>, nativePointer: string) => DiagnosticIssue[];

const invalid = (control: NativeRequestControl, issue: NativeRequestIssueFactory, path: Array<string | number>) => [issue(path, `Invalid value for ${control.label}.`)];
const check = (valid: (control: NativeRequestControl, value: JsonValue) => boolean): ValueIssues =>
  (control, value, issue, path) => (valid(control, value) ? [] : invalid(control, issue, path));

const isEnumValue = (control: NativeRequestControl, value: JsonValue) => control.options!.some((option) => JSON.stringify(option.value) === JSON.stringify(value));

const valueIssues: Record<NativeRequestControl['kind'], ValueIssues> = {
  text: check((_control, value) => typeof value === 'string'),
  multiline: check((_control, value) => typeof value === 'string'),
  boolean: check((_control, value) => typeof value === 'boolean'),
  number: check(isBoundedNumber),
  integer: check((control, value) => Number.isInteger(value) && isBoundedNumber(control, value)),
  enum: check(isEnumValue),
  'multi-enum': check((control, value) => Array.isArray(value) && value.every((entry) => isEnumValue(control, entry))),
  object: (control, value, issue, path, nativePointer) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid(control, issue, path);
    if (Object.keys(value).some((key) => !control.properties!.some((property) => property.key === key))) return invalid(control, issue, path);
    return control.properties!.flatMap((property) => nativeRequestValueIssues(property, value[property.key], issue, [...path, property.key], jsonPointerChild(nativePointer, property.key)));
  },
  array: (control, value, issue, path, nativePointer) => {
    if (!Array.isArray(value)) return invalid(control, issue, path);
    return value.flatMap((entry, index) => nativeRequestValueIssues(control.element!, entry, issue, [...path, index], `${nativePointer}/${index}`));
  },
};

function isBoundedNumber(control: NativeRequestControl, value: JsonValue): boolean {
  return typeof value === 'number' && Number.isFinite(value)
    && (control.minimum === undefined || value >= control.minimum)
    && (control.maximum === undefined || value <= control.maximum);
}

/** Issues of a values record: only declared keys, each valid for its control. */
export function nativeRequestValuesIssues(controls: NativeRequestControls, values: Record<string, JsonValue>, issue: NativeRequestIssueFactory, path: Array<string | number>): DiagnosticIssue[] {
  const declared = nativeRequestControlList(controls);
  return [
    ...Object.keys(values)
      .filter((key) => !declared.some((control) => control.key === key))
      .map((key) => issue([...path, key], `${key} is not a declared native control.`)),
    ...declared.flatMap((control) => nativeRequestValueIssues(control, values[control.key], issue, [...path, control.key])),
  ];
}

/** Initial values of every control that declares one, keyed by JSON Pointer. */
export function initialNativeRequestValues(controls: NativeRequestControls): Record<string, JsonValue> {
  return Object.fromEntries(nativeRequestControlList(controls)
    .filter((control) => control.initialValue !== undefined)
    .map((control) => [control.key, control.initialValue!]));
}
