import { createDiagnosticError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { panelResourceResult, panelToolResult } from '../panel-sessions/panel-results.js';

export type DialogueDirectionErrorCode =
  | 'CODEX_DIALOGUE_DIRECTION_INVALID'
  | 'CODEX_DIALOGUE_DIRECTION_NOT_FOUND'
  | 'CODEX_DIALOGUE_DIRECTION_BUSY'
  | 'CODEX_DIALOGUE_DIRECTION_UNSUPPORTED';

export function directionError(code: DialogueDirectionErrorCode, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function directionIssue(path: Array<string | number>, message: string): DiagnosticIssue {
  return createDiagnosticError('CODEX_DIALOGUE_DIRECTION_INVALID', message, { path: path.map(String) });
}

export function assertNoDirectionIssues(issues: DiagnosticIssue[], message: string): void {
  if (issues.length === 0) return;
  throw new StructuredError({ code: 'CODEX_DIALOGUE_DIRECTION_INVALID', message, issues });
}

export function directionToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return panelToolResult(operation, runtimeFailure);
}

export function directionResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  return panelResourceResult(operation, runtimeFailure);
}

function runtimeFailure(): StructuredError {
  return directionError('CODEX_DIALOGUE_DIRECTION_INVALID', 'The local dialogue direction runtime failed.', 'Check the local runtime diagnostics.');
}
