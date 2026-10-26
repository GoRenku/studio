import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { z } from 'zod';
import { createProjectDataService, type StudioProjectRef } from '@gorenku/studio-core/server';
import { assertGenerationReviewCapability } from '../generation-review-capabilities.js';
import { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { CastingBoard, CastingBoardMode } from './contracts.js';
import { castingBoardToolResult } from './diagnostics.js';
import { castingBoardOpenSchema } from './schemas.js';
import { projectCastingBoard } from './session-projection.js';
import { CASTING_BOARD_SCHEME, type CastingBoardState, type CastingBoardSubject } from './session-state.js';

export const CASTING_BOARD_URI = 'ui://renku/casting-board';

type CastingBoardOpening = z.infer<typeof castingBoardOpenSchema>;

type OpeningOf<M extends CastingBoardMode> = Extract<CastingBoardOpening, { mode: M }>;

const SUBJECT_RESOLVERS: { [M in CastingBoardMode]: (input: OpeningOf<M>, projectRef: StudioProjectRef, homeDir?: string) => Promise<CastingBoardSubject> } = {
  candidates: async (input, projectRef, homeDir) => {
    const { look } = await createProjectDataService().showCastingLook({ projectName: projectRef.name, homeDir, lookId: input.lookId });
    return { mode: 'candidates', castMemberId: look.castMemberId, lookId: look.id };
  },
  sheets: async (input, projectRef, homeDir) => {
    const { look } = await createProjectDataService().showCastingLook({ projectName: projectRef.name, homeDir, lookId: input.lookId });
    return { mode: 'sheets', castMemberId: look.castMemberId, lookId: look.id, costumeId: input.costumeId ?? null };
  },
};

export function registerCastingBoardOpening(server: McpServer, state: CastingBoardState, homeDir?: string): void {
  registerAppTool(server, 'casting.board.open', {
    title: 'Open the casting board',
    description: 'Show the casting board inline. candidates mode shows every casting round of one Look, filling in as candidates are imported, with hide, compare and cast. sheets mode shows the character sheet rounds of one Look\'s costumes, one costume at a time, with hide, compare and pick. Hide and picks are saved directly; Cast and "More like these" post a message. Return immediately and end the turn, or keep generating and importing images.',
    inputSchema: castingBoardOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: CASTING_BOARD_URI, visibility: ['model'] } },
  }, (input) => castingBoardToolResult(async () => {
    assertGenerationReviewCapability(server);
    const board = await openCastingBoard(state, input, homeDir);
    return {
      content: [{ type: 'text' as const, text: `Casting board ${board.sessionId} is open. Candidates imported for this Look appear on it automatically. Each request the user sends arrives as a message; consume it once with casting.board.consume.` }],
      structuredContent: { session: board },
    };
  }));
}

export async function openCastingBoard(state: CastingBoardState, input: CastingBoardOpening, homeDir?: string): Promise<CastingBoard> {
  const projectRef = await createProjectDataService().resolveStudioProjectRef({ projectName: input.project, homeDir });
  const resolve = SUBJECT_RESOLVERS[input.mode] as (input: CastingBoardOpening, projectRef: StudioProjectRef, homeDir?: string) => Promise<CastingBoardSubject>;
  const subject = await resolve(input, projectRef, homeDir);
  const sessionId = randomUUID();
  const record = state.create(sessionId, { projectRef, subject, media: new PanelMediaRegistry(CASTING_BOARD_SCHEME, sessionId) });
  return projectCastingBoard(record, homeDir);
}
