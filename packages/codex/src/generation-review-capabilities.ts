import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUiCapability, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { GenerationReviewCapabilities } from './client.js';
import { reviewError } from './diagnostics.js';

export function readGenerationReviewCapabilities(server: McpServer): GenerationReviewCapabilities {
  const client = server.server.getClientVersion() ?? null;
  if (client?.name !== 'codex-mcp-client') {
    return { client, panel: { status: 'unavailable', reason: 'non-codex-client' } };
  }
  const ui = getUiCapability(server.server.getClientCapabilities() ?? {});
  if (!ui?.mimeTypes?.includes(RESOURCE_MIME_TYPE)) {
    return { client, panel: { status: 'unavailable', reason: 'mcp-app-ui-unavailable' } };
  }
  return { client, panel: { status: 'advertised', reason: 'codex-ui-advertised' } };
}

export function assertGenerationReviewCapability(server: McpServer): void {
  const capabilities = readGenerationReviewCapabilities(server);
  if (capabilities.panel.status !== 'advertised') {
    throw reviewError(
      'CODEX_REVIEW_UNSUPPORTED',
      `This connection cannot open a Codex generation review panel (${capabilities.panel.reason}).`,
      'Use the Media Producer conversational workflow and mandatory Studio Preview in this host.'
    );
  }
}
