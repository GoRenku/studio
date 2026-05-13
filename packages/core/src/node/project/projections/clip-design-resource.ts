import { eq } from 'drizzle-orm';
import { clips } from '../../../schema/index.js';
import type { ClipDesignResource } from '../../../project/index.js';
import type { ProjectDataSession } from '../data/sqlite-project-store.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../data/asset-relationship-records.js';
import { clipRichTextRoles, readRichTextAssetLink } from '../data/rich-text-asset-links.js';
import { readClipParentChain } from './movie-studio-selection-context.js';

export function readClipDesignResourceProjection(
  session: ProjectDataSession,
  input: {
    clipId: string;
    activeRole?: string;
    limit?: number;
    cursor?: string | null;
  }
): ClipDesignResource {
  const chain = readClipParentChain(session, input.clipId);
  const clipRow = session.db
    .select()
    .from(clips)
    .where(eq(clips.id, input.clipId))
    .get();
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
