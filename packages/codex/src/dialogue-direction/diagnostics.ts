import { createDiagnosticError, isStructuredError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { ErrorCode, McpError, type CallToolResult, type ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { integrationErrorResult } from '../diagnostics.js';

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

export async function directionToolResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await operation();
  } catch (error) {
    return integrationErrorResult(structuredFailure(error));
  }
}

export async function directionResourceResult(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  try {
    return await operation();
  } catch (error) {
    const failure = integrationErrorResult(structuredFailure(error));
    throw new McpError(ErrorCode.InternalError, failure.content[0]!.text, failure.structuredContent);
  }
}

function structuredFailure(error: unknown): StructuredError {
  return isStructuredError(error)
    ? error
    : directionError('CODEX_DIALOGUE_DIRECTION_INVALID', 'The local dialogue direction runtime failed.', 'Check the local runtime diagnostics.');
}
