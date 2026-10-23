import type { DirectorCastReadiness } from '../../client/index.js';
import { listAssetFilePageInSession } from '../asset-files/projection.js';
import { readActiveCastDesignId } from '../database/access/cast-designs.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export function readCastReadiness(session: DatabaseSession): DirectorCastReadiness {
  const visualCastMembers = listCastMemberRecords(session).filter(
    (castMember) => !castMember.isVoiceOver
  );
  const missingVisualReferenceCastMemberIds: string[] = [];
  const missingActiveCastDesignCastMemberIds: string[] = [];
  let visualReferenceCount = 0;
  let activeCastDesignCount = 0;

  for (const castMember of visualCastMembers) {
    if (readActiveCastDesignId(session, castMember.id)) {
      activeCastDesignCount += 1;
    } else {
      missingActiveCastDesignCastMemberIds.push(castMember.id);
    }
    const assetFiles = listAssetFilePageInSession(session, {
      owner: { kind: 'castMember', id: castMember.id },
      limit: 200,
    }).items.filter(
      (assetFile) => assetFile.type === 'character_sheet' || assetFile.type === 'cast_profile'
    );
    visualReferenceCount += assetFiles.length;
    if (assetFiles.length === 0) {
      missingVisualReferenceCastMemberIds.push(castMember.id);
    }
  }

  return {
    castMemberCount: visualCastMembers.length,
    activeCastDesignCount,
    missingActiveCastDesignCastMemberIds,
    visualReferenceCount,
    missingVisualReferenceCastMemberIds,
    everyCastMemberHasVisualReference:
      visualCastMembers.length > 0 &&
      missingVisualReferenceCastMemberIds.length === 0,
  };
}
