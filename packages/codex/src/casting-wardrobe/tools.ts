import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CastingWardrobeConsumeResult, CastingWardrobePanel } from './contracts.js';
import { castingWardrobeToolResult } from './diagnostics.js';
import { validateCastingWardrobeDraft } from './draft-validation.js';
import { castingWardrobeConsumeSchema, castingWardrobeRespondSchema } from './schemas.js';
import type { CastingWardrobeState } from './session-state.js';

export function registerCastingWardrobeTools(server: McpServer, state: CastingWardrobeState): void {
  registerAppTool(server, 'casting.wardrobe.respond', {
    title: 'Record the edited Looks or wardrobe plan', inputSchema: castingWardrobeRespondSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingWardrobeToolResult(async () => ({ content: [], structuredContent: { panel: respondToCastingWardrobe(state, input) } })));
  registerAppTool(server, 'casting.wardrobe.consume', {
    title: 'Consume the edited Looks or wardrobe plan',
    description: 'Consume the user\'s edited plan once. sent returns the castLooksPlan or castWardrobePlan draft: validate it with renku cast looks|wardrobe validate, then write it with renku cast looks|wardrobe write. canceled means stop quietly; alreadyConsumed authorizes nothing.',
    inputSchema: castingWardrobeConsumeSchema,
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingWardrobeToolResult(async () => ({ content: [], structuredContent: { ...consumeCastingWardrobe(state, input.panelId) } })));
}

/** Records the edited draft once; it never writes Looks or costumes. */
export function respondToCastingWardrobe(
  state: CastingWardrobeState,
  input: { panelId: string; choice: { kind: 'send'; draft: unknown } | { kind: 'canceled' } },
): CastingWardrobePanel {
  const { panel } = state.record(input.panelId);
  if (input.choice.kind === 'canceled') return state.answer(input.panelId, { kind: 'canceled' }) as CastingWardrobePanel;
  const draft = validateCastingWardrobeDraft(panel.mode, panel.castMember.id, input.choice.draft, ['choice', 'draft']);
  return state.answer(input.panelId, { kind: 'send', draft }) as CastingWardrobePanel;
}

export function consumeCastingWardrobe(state: CastingWardrobeState, panelId: string): CastingWardrobeConsumeResult {
  const answer = state.consume(panelId);
  if (!answer) return { status: 'alreadyConsumed', panelId };
  if (answer.kind === 'canceled') return { status: 'canceled', panelId };
  const { panel } = state.record(panelId);
  return { status: 'sent', panelId, mode: panel.mode, draft: answer.draft } as CastingWardrobeConsumeResult;
}
