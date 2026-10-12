/**
 * Type-only, browser-safe contract for schema-derived native request controls.
 * This file is the `@gorenku/studio-codex/native-request-controls` package export; keep it free of runtime code.
 */
import type { JsonValue } from '@gorenku/studio-core/client';

export type NativeRequestControlKind = 'text' | 'multiline' | 'number' | 'integer' | 'boolean' | 'enum' | 'multi-enum' | 'object' | 'array';

export interface NativeRequestControl {
  /** Root controls use exact native request JSON Pointers; object properties use native property names. */
  key: string;
  label: string;
  description?: string;
  kind: NativeRequestControlKind;
  initialValue?: JsonValue;
  required?: boolean;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: Array<{ value: JsonValue; label: string; description?: string }>;
  properties?: NativeRequestControl[];
  element?: NativeRequestControl;
}

export interface NativeRequestControlGroup {
  label: string;
  fields: NativeRequestControl[];
}

export interface NativeRequestControls {
  groups: NativeRequestControlGroup[];
}
