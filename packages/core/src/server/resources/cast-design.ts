import type { CastDesignResource } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import {
  countAssetRelationshipsByRole,
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import type { ReadCastDesignResourceInput } from '../project-data-service-contracts.js';

export async function readCastDesignResource(
  input: ReadCastDesignResourceInput
): Promise<CastDesignResource> {
  const { session } = await openProjectSession(input);
  try {
    return readCastDesignResourceProjection(session, input);
  } finally {
    session.close();
  }
}

export function readCastDesignResourceProjection(
  session: DatabaseSession,
  input: {
    castMemberId: string;
    activeRole?: string;
    limit?: number;
    cursor?: string | null;
  }
): CastDesignResource {
  const castMember = readCastMemberRecord(session, input.castMemberId);
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
      handle: castMember.handle,
      name: castMember.name,
      role: castMember.role ?? undefined,
      age: castMember.age ?? undefined,
      want: castMember.want ?? undefined,
      need: castMember.need ?? undefined,
      arc: castMember.arc ?? undefined,
      voiceNotes: castMember.voiceNotes ?? undefined,
      description: castMember.description ?? undefined,
    },
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
