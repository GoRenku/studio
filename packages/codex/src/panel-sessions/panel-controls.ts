import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { NativeRequestControlKind, NativeRequestControls } from '../native-request-controls/contracts.js';
import { nativeRequestControlIssues, type NativeRequestIssueFactory } from '../native-request-controls/validation.js';

const PANEL_CONTROL_KINDS: ReadonlySet<NativeRequestControlKind> = new Set(['text', 'number', 'integer', 'boolean', 'enum']);

/**
 * Native Request Controls a panel can present compactly: scalar kinds only, each with an
 * initial value and never nullable. Adds the panel profile to the shared structural rules.
 */
export function panelControlIssues(controls: NativeRequestControls, issue: NativeRequestIssueFactory, path: Array<string | number>): DiagnosticIssue[] {
  return [
    ...nativeRequestControlIssues(controls, issue, path),
    ...controls.groups.flatMap((group, groupIndex) => group.fields.flatMap((control, index) => {
      const at = [...path, 'groups', groupIndex, 'fields', index];
      return [
        ...(PANEL_CONTROL_KINDS.has(control.kind) ? [] : [issue([...at, 'kind'], `${control.label} uses the ${control.kind} kind, which panels cannot present.`)]),
        ...(control.initialValue === undefined ? [issue([...at, 'initialValue'], `${control.label} needs an initial value in a panel.`)] : []),
        ...(control.nullable ? [issue([...at, 'nullable'], `${control.label} cannot be nullable in a panel.`)] : []),
      ];
    })),
  ];
}
