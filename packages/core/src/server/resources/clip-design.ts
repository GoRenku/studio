import type { ClipDesignResource } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readClipRecord } from '../database/access/narrative.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import { clipRichTextRoles, readRichTextAssetLink } from '../database/access/rich-text-asset-links.js';
import { readClipParentChain } from '../database/access/navigation.js';
import type { ReadClipDesignResourceInput } from '../project-data-service-contracts.js';

export async function readClipDesignResource(
  input: ReadClipDesignResourceInput
): Promise<ClipDesignResource> {
  const { session } = await openProjectSession(input);
  try {
    return readClipDesignResourceProjection(session, input);
  } finally {
    session.close();
  }
}

export function readClipDesignResourceProjection(
  session: DatabaseSession,
  input: {
    clipId: string;
    activeRole?: string;
    limit?: number;
    cursor?: string | null;
  }
): ClipDesignResource {
  const chain = readClipParentChain(session, input.clipId);
  const clipRow = readClipRecord(session, input.clipId);
  const target = { kind: 'clip' as const, clipId: input.clipId };
  return {
    clip: {
      id: chain.clip.id,
      title: chain.clip.title,
      summary: clipRow?.oneLineSummary ?? undefined,
      summaryAsset: readRichTextAssetLink(session, {
        target,
        role: 'summary',
        relationshipLabel: 'clip',
        richTextRoles: clipRichTextRoles(),
      }),
      visualIntentAsset: readRichTextAssetLink(session, {
        target,
        role: 'visual_intent',
        relationshipLabel: 'clip',
        richTextRoles: clipRichTextRoles(),
      }),
    },
    scene: chain.scene,
    sequence: chain.sequence,
    episode: chain.episode,
    selectedAssets: listAssetRelationshipPage(session, {
      target,
      selection: 'select',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items,
    activeTakePage: listAssetRelationshipPage(session, {
      target,
      role: input.activeRole,
      selection: 'take',
      limit: input.limit,
      cursor: input.cursor,
    }),
  };
}
