import { eq } from 'drizzle-orm';
import { castMembers } from '../schema/index.js';
import type { CastDesignResource } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  countAssetRelationshipsByRole,
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import {
  castMemberRichTextRoles,
  readRichTextAssetLink,
} from '../database/access/rich-text-asset-links.js';

export function readCastDesignResourceProjection(
  session: DatabaseSession,
  input: {
    castMemberId: string;
    activeRole?: string;
    limit?: number;
    cursor?: string | null;
  }
): CastDesignResource {
  const castMember = session.db
    .select()
    .from(castMembers)
    .where(eq(castMembers.id, input.castMemberId))
    .get();
  if (!castMember) {
    throw new ProjectDataError(
      'PROJECT_DATA115',
      `Cast member was not found: ${input.castMemberId}.`
    );
  }
  const target = {
    kind: 'castMember' as const,
    castMemberId: input.castMemberId,
  };
  return {
    castMember: {
      id: castMember.id,
      name: castMember.name,
      kind: castMember.kind ?? undefined,
      role: castMember.role ?? undefined,
      shortDescription: castMember.shortDescription ?? undefined,
    },
    descriptionAsset: readRichTextAssetLink(session, {
      target,
      role: 'description',
      relationshipLabel: 'Cast description',
      richTextRoles: castMemberRichTextRoles(),
    }),
    selectedAssets: listAssetRelationshipPage(session, {
      target,
      selection: 'select',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items,
    activeTakePage: listAssetRelationshipPage(session, {
      target,
      role: input.activeRole ?? 'character_sheet',
      selection: 'take',
      limit: input.limit,
      cursor: input.cursor,
    }),
    countsByRole: countAssetRelationshipsByRole(session, target),
  };
}
