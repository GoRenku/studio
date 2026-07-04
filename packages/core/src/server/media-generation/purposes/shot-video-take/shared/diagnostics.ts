import {
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';



export function issue(
  code: string,
  message: string,
  pathSegments: string[],
  suggestion: string
): DiagnosticIssue {
  return createDiagnosticError(code, message, { path: pathSegments }, suggestion);
}
