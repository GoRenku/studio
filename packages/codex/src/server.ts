import fs from 'node:fs/promises';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError, type ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { OpenAIExtensions, type OpenAIUiResourceMetadata } from '@openai/mcp-extensions/server';
import { generationReviewConsumeSchema, generationReviewInputSchema, generationReviewResponseSchema } from './generation-review-schemas.js';
import { generationReviewResult, openGenerationReview } from './generation-review.js';
import { GenerationReviewState } from './generation-review-state.js';
import { consumeGenerationReview, respondToGenerationReview } from './generation-review-responses.js';
import { readGenerationReference } from './generation-reference-resources.js';
import { integrationErrorResult } from './diagnostics.js';

export interface CodexServerOptions {
  version: string;
  generationReviewHtml: string;
  homeDir?: string;
}

const REVIEW_URI = 'ui://renku/generation-review';
const displayMetadata = { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] } satisfies OpenAIUiResourceMetadata;

export function createCodexServer(options: CodexServerOptions): McpServer {
  const server = new McpServer({ name: 'renku', version: options.version });
  new OpenAIExtensions(server);
  const state = new GenerationReviewState();
  registerHtmlResource(server, REVIEW_URI, 'Generation review', options.generationReviewHtml, { connectDomains: ['blob:'], resourceDomains: ['blob:'] });
  registerReviewTools(server, state, options.homeDir);
  registerReviewResources(server, state, options.homeDir);
  server.server.onclose = () => state.expire();
  return server;
}

export async function startCodexServer(options: CodexServerOptions): Promise<void> {
  await createCodexServer(options).connect(new StdioServerTransport());
}

function registerReviewTools(server: McpServer, state: GenerationReviewState, homeDir?: string): void {
  registerAppTool(server, 'generation.review', {
    title: 'Generation review', inputSchema: generationReviewInputSchema,
    description: 'Open or refresh the combined generation review panel. Return immediately, end the turn, and wait for its submitted action. This tool never executes generation.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: REVIEW_URI, visibility: ['model'] } },
  }, (input) => guardedResult(async () => generationReviewResult(await openGenerationReview(state, input, homeDir))));
  registerAppTool(server, 'generation.review.respond', {
    title: 'Respond to generation review', inputSchema: generationReviewResponseSchema,
    _meta: { ui: { resourceUri: REVIEW_URI, visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => guardedResult(async () => ({ content: [], structuredContent: { ...(await respondToGenerationReview(state, input, homeDir)) } })));
  registerAppTool(server, 'generation.review.consume', {
    title: 'Consume generation review action', inputSchema: generationReviewConsumeSchema,
    description: 'Consume the exact panel action once. alreadyConsumed authorizes no repeated execution. Continue generation through the existing Skill and CLI only after consuming a submit action.',
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => guardedResult(async () => ({ content: [], structuredContent: { ...(await consumeGenerationReview(state, input, homeDir)) } })));
}

function registerReviewResources(server: McpServer, state: GenerationReviewState, homeDir?: string): void {
  server.registerResource('Review state', new ResourceTemplate('renku-review://{reviewId}', { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => guardedResource(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(state.read(String(variables.reviewId))) }],
  })));
  server.registerResource('Review reference', new ResourceTemplate('renku-reference://{reviewId}/{referenceId}', { list: undefined }), {}, (uri) => guardedResource(() => readGenerationReference(state, uri.href, homeDir)));
  server.registerResource('Review thumbnail', new ResourceTemplate('renku-reference://{reviewId}/{referenceId}/thumbnail', { list: undefined }), { mimeType: 'image/webp' }, (uri) => guardedResource(() => readGenerationReference(state, uri.href, homeDir)));
}

function registerHtmlResource(server: McpServer, uri: string, title: string, file: string, csp: { connectDomains: string[]; resourceDomains: string[] }): void {
  registerAppResource(server, title, uri, {}, () => guardedResource(async () => ({
    contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: await fs.readFile(file, 'utf8'), _meta: { 'openai/ui': displayMetadata, ui: { csp } } }],
  })));
}

async function guardedResource(operation: () => Promise<ReadResourceResult>): Promise<ReadResourceResult> {
  try {
    return await operation();
  } catch (error) {
    const failure = integrationErrorResult(error);
    throw new McpError(ErrorCode.InternalError, failure.content[0]!.text, failure.structuredContent);
  }
}

async function guardedResult(operation: () => Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>) {
  try {
    return await operation();
  } catch (error) {
    return integrationErrorResult(error);
  }
}
