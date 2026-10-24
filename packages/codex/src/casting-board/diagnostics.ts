import { StructuredError } from '@gorenku/studio-diagnostics';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { panelResourceResult, panelToolResult } from '../panel-sessions/panel-results.js';

export type CastingBoardErrorCode =
  | 'CODEX_CASTING_BOARD_INVALID'
  | 'CODEX_CASTING_BOARD_NOT_FOUND'
  | 'CODEX_CASTING_BOARD_BUSY';

export function castingBoardError(code: CastingBoardErrorCode, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function castingBoardToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return panelToolResult(operation, runtimeFailure);
}

export function castingBoardResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  return panelResourceResult(operation, runtimeFailure);
}

function runtimeFailure(): StructuredError {
  return castingBoardError('CODEX_CASTING_BOARD_INVALID', 'The local casting board runtime failed.', 'Check the local runtime diagnostics.');
}
