import type { CastingRoundSubject } from '../../../client/casting/model.js';
import { assetFileSelectionTargetKey } from '../../asset-files/selection-targets.js';
import { readCastCostumeRecord, type CastCostumeRecord } from '../../database/access/casting/costumes.js';
import { readCastLookRecord, type CastLookRecord } from '../../database/access/casting/looks.js';
import { readSelectedAssetFileRecord } from '../../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import { costumeNotFound, lookNotFound } from '../diagnostics.js';

/** The Look a round's images show; a costume round also names its costume. */
export interface ResolvedCastingRoundSubject {
  castMemberId: string;
  look: CastLookRecord;
  costume: CastCostumeRecord | null;
}

const SUBJECT_RESOLVERS: Record<CastingRoundSubject['kind'], (session: DatabaseSession, id: string) => ResolvedCastingRoundSubject> = {
  castLook: (session, id) => {
    const look = readCastLookRecord(session, id);
    if (!look) {
      throw lookNotFound(id);
    }
    return { castMemberId: look.castMemberId, look, costume: null };
  },
  castCostume: (session, id) => {
    const costume = readCastCostumeRecord(session, id);
    const look = costume ? readCastLookRecord(session, costume.lookId) : null;
    if (!costume || !look) {
      throw costumeNotFound(id);
    }
    return { castMemberId: costume.castMemberId, look, costume };
  },
};

export function resolveCastingRoundSubject(session: DatabaseSession, subject: CastingRoundSubject): ResolvedCastingRoundSubject {
  return SUBJECT_RESOLVERS[subject.kind](session, subject.id);
}

/** Character sheets keep the cast face, so a costume's Look must be cast before its first sheet round. */
export function assertCostumeLookCast(session: DatabaseSession, resolved: ResolvedCastingRoundSubject): void {
  if (!resolved.costume) {
    return;
  }
  const cast = readSelectedAssetFileRecord(session, assetFileSelectionTargetKey({ kind: 'castLook', id: resolved.look.id }));
  if (!cast) {
    throw new ProjectDataError(
      'CASTING_ROUND_LOOK_NOT_CAST',
      `${resolved.costume.name} belongs to the Look ${resolved.look.name}, which is not cast yet.`,
      { suggestion: 'Cast the Look first; its cast candidate is the identity reference for the character sheets.' },
    );
  }
}
