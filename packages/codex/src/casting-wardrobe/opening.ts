import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { z } from 'zod';
import type { CastCastingResource } from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { assertGenerationReviewCapability } from '../generation-review-capabilities.js';
import { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { CastingWardrobeMode, CastingWardrobePanel } from './contracts.js';
import { castingWardrobeToolResult } from './diagnostics.js';
import { validateCastingWardrobeDraft } from './draft-validation.js';
import { castingWardrobeOpenSchema } from './schemas.js';
import { CASTING_WARDROBE_SCHEME, type CastingWardrobeState, type CastingWardrobeView } from './session-state.js';

export const CASTING_WARDROBE_URI = 'ui://renku/casting-wardrobe';

type CastingWardrobeOpening = z.infer<typeof castingWardrobeOpenSchema>;
type WardrobeViewBase = Omit<CastingWardrobeView, 'mode' | 'draft' | 'sheetPickedCostumeIds'>;

/** Each mode adds its own draft and details to the shared scene strip view. */
const MODE_VIEWS: Record<CastingWardrobeMode, (base: WardrobeViewBase, input: CastingWardrobeOpening, resource: CastCastingResource) => CastingWardrobeView> = {
  looks: (base, input) => ({ ...base, mode: 'looks', draft: validateCastingWardrobeDraft('looks', input.castMemberId, input.draft, ['draft']) }),
  costumes: (base, input, resource) => ({
    ...base,
    mode: 'costumes',
    draft: validateCastingWardrobeDraft('costumes', input.castMemberId, input.draft, ['draft']),
    sheetPickedCostumeIds: resource.costumes.filter((costume) => costume.characterSheetAssetFileId).map((costume) => costume.id),
  }),
};

export function registerCastingWardrobeOpening(server: McpServer, state: CastingWardrobeState, homeDir?: string): void {
  registerAppTool(server, 'casting.wardrobe.open', {
    title: 'Open the Looks and wardrobe panel',
    description: 'Show a proposed castLooksPlan (looks mode) or castWardrobePlan (costumes mode) inline on a scene strip. The user moves scenes between Looks or costumes and sends the plan back. The panel never writes; consume the edited draft, then validate and write it with the CLI. Return immediately and end the turn.',
    inputSchema: castingWardrobeOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: CASTING_WARDROBE_URI, visibility: ['model'] } },
  }, (input) => castingWardrobeToolResult(async () => {
    assertGenerationReviewCapability(server);
    const panel = await openCastingWardrobe(state, input, homeDir);
    return {
      content: [{ type: 'text' as const, text: `Looks and wardrobe panel ${panel.panelId} is open. End the turn now and wait. The edited plan arrives as a message; consume it once with casting.wardrobe.consume.` }],
      structuredContent: { panel },
    };
  }));
}

export async function openCastingWardrobe(state: CastingWardrobeState, input: CastingWardrobeOpening, homeDir?: string): Promise<CastingWardrobePanel> {
  const projectData = createProjectDataService();
  const projectRef = await projectData.resolveStudioProjectRef({ projectName: input.project, homeDir });
  const resource = await projectData.readCastCastingResource({ projectName: projectRef.name, homeDir, castMemberId: input.castMemberId });
  const panelId = randomUUID();
  const media = new PanelMediaRegistry(CASTING_WARDROBE_SCHEME, panelId);
  const base: WardrobeViewBase = {
    panelId,
    castMember: resource.castMember,
    scenes: resource.scenes,
    looks: resource.looks.map((look) => ({
      id: look.id,
      name: look.name,
      sceneIds: look.sceneIds,
      castImageUri: look.castCandidate ? media.uri(look.castCandidate.projectRelativePath) : null,
    })),
  };
  return state.create(MODE_VIEWS[input.mode](base, input, resource), { projectRef, media }) as CastingWardrobePanel;
}
