import { isStructuredError, type StructuredError } from '@gorenku/studio-diagnostics';
import { ErrorCode, McpError, type CallToolResult, type ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { integrationErrorResult } from '../diagnostics.js';

/** Runs a panel tool and serializes any failure; unstructured failures become the family's fallback error. */
export async function panelToolResult(operation: () => Promise<CallToolResult>, fallback: () => StructuredError): Promise<CallToolResult> {
  try {
    return await operation();
  } catch (error) {
    return integrationErrorResult(isStructuredError(error) ? error : fallback());
  }
}

/** Runs a panel resource read and raises failures as MCP errors carrying the structured diagnostic. */
export async function panelResourceResult(operation: () => Promise<ReadResourceResult>, fallback: () => StructuredError): Promise<ReadResourceResult> {
  try {
    return await operation();
  } catch (error) {
    const failure = integrationErrorResult(isStructuredError(error) ? error : fallback());
    throw new McpError(ErrorCode.InternalError, failure.content[0]!.text, failure.structuredContent);
  }
}
