import { createDiagnosticError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { panelResourceResult, panelToolResult } from '../panel-sessions/panel-results.js';

export type CastingRoundErrorCode =
  | 'CODEX_CASTING_ROUND_INVALID'
  | 'CODEX_CASTING_ROUND_NOT_FOUND'
  | 'CODEX_CASTING_ROUND_NOT_SYNCED';

export function castingRoundError(code: CastingRoundErrorCode, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function castingRoundIssue(path: Array<string | number>, message: string): DiagnosticIssue {
  return createDiagnosticError('CODEX_CASTING_ROUND_INVALID', message, { path: path.map(String) });
}

export function assertNoCastingRoundIssues(issues: DiagnosticIssue[], message: string): void {
  if (issues.length === 0) return;
  throw new StructuredError({ code: 'CODEX_CASTING_ROUND_INVALID', message, issues });
}

export function castingRoundToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return panelToolResult(operation, runtimeFailure);
}

export function castingRoundResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  return panelResourceResult(operation, runtimeFailure);
}

function runtimeFailure(): StructuredError {
  return castingRoundError('CODEX_CASTING_ROUND_INVALID', 'The local Casting round runtime failed.', 'Check the local runtime diagnostics.');
}
