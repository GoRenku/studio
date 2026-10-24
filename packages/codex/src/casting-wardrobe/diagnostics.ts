import { createDiagnosticError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { panelResourceResult, panelToolResult } from '../panel-sessions/panel-results.js';

export type CastingWardrobeErrorCode =
  | 'CODEX_CASTING_WARDROBE_INVALID'
  | 'CODEX_CASTING_WARDROBE_NOT_FOUND';

export function castingWardrobeError(code: CastingWardrobeErrorCode, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function castingWardrobeIssue(path: Array<string | number>, message: string): DiagnosticIssue {
  return createDiagnosticError('CODEX_CASTING_WARDROBE_INVALID', message, { path: path.map(String) });
}

export function assertNoCastingWardrobeIssues(issues: DiagnosticIssue[], message: string): void {
  if (issues.length === 0) return;
  throw new StructuredError({ code: 'CODEX_CASTING_WARDROBE_INVALID', message, issues });
}

export function castingWardrobeToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return panelToolResult(operation, runtimeFailure);
}

export function castingWardrobeResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  return panelResourceResult(operation, runtimeFailure);
}

function runtimeFailure(): StructuredError {
  return castingWardrobeError('CODEX_CASTING_WARDROBE_INVALID', 'The local Looks and wardrobe runtime failed.', 'Check the local runtime diagnostics.');
}
