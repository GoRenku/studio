import { createDiagnosticError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { panelResourceResult, panelToolResult } from '../panel-sessions/panel-results.js';

export type ImageEditErrorCode =
  | 'CODEX_IMAGE_EDIT_INVALID'
  | 'CODEX_IMAGE_EDIT_NOT_FOUND'
  | 'CODEX_IMAGE_EDIT_BUSY'
  | 'CODEX_IMAGE_EDIT_UNSUPPORTED';

export function imageEditError(code: ImageEditErrorCode, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function imageEditIssue(path: Array<string | number>, message: string): DiagnosticIssue {
  return createDiagnosticError('CODEX_IMAGE_EDIT_INVALID', message, { path: path.map(String) });
}

export function assertNoImageEditIssues(issues: DiagnosticIssue[], message: string): void {
  if (issues.length === 0) {
    return;
  }
  throw new StructuredError({ code: 'CODEX_IMAGE_EDIT_INVALID', message, issues });
}

export function imageEditToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return panelToolResult(operation, runtimeFailure);
}

export function imageEditResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  return panelResourceResult(operation, runtimeFailure);
}

function runtimeFailure(): StructuredError {
  return imageEditError('CODEX_IMAGE_EDIT_INVALID', 'The local image edit runtime failed.', 'Check the local runtime diagnostics.');
}
