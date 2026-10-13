import { StructuredError } from '@gorenku/studio-diagnostics';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { panelResourceResult, panelToolResult } from '../panel-sessions/panel-results.js';

export type RouteChoiceErrorCode =
  | 'CODEX_ROUTE_CHOICE_INVALID'
  | 'CODEX_ROUTE_CHOICE_NOT_FOUND'
  | 'CODEX_ROUTE_CHOICE_NOT_SYNCED';

export function routeChoiceError(code: RouteChoiceErrorCode, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function routeChoiceToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return panelToolResult(operation, runtimeFailure);
}

export function routeChoiceResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  return panelResourceResult(operation, runtimeFailure);
}

function runtimeFailure(): StructuredError {
  return routeChoiceError('CODEX_ROUTE_CHOICE_INVALID', 'The local Route Chooser runtime failed.', 'Check the local runtime diagnostics.');
}
