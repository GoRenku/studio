import type { NativeRequestControls } from '@gorenku/studio-codex/native-request-controls';
import type { JsonValue } from '@gorenku/studio-core/client';

/** Initial values of every control, keyed by native JSON Pointer; panel controls always declare one. */
export function initialNativeRequestValues(controls: NativeRequestControls): Record<string, JsonValue> {
  return Object.fromEntries(controls.groups.flatMap((group) => group.fields)
    .filter((control) => control.initialValue !== undefined)
    .map((control) => [control.key, control.initialValue!]));
}
