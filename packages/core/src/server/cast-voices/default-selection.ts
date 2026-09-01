import type { CastVoiceDefaultSelectionReport } from '../../client/cast-voices.js';
import { selectCastVoiceDefaultRecord } from '../database/access/cast-voices.js';
import { studioAssetOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
import { listCastVoicesInSession, requireCastMember, requireCastVoiceRecord } from './projection.js';
import { withCastVoiceProjectSession, type CastVoiceProjectInput } from './project-session.js';

export interface SelectDefaultCastVoiceInput extends CastVoiceProjectInput {
  castMemberId: string;
  castVoiceId: string;
}

export async function selectDefaultCastVoice(
  input: SelectDefaultCastVoiceInput
): Promise<CastVoiceDefaultSelectionReport> {
  return withCastVoiceProjectSession(input, ({ currentProject, session }) => {
    requireCastMember(session, input.castMemberId);
    requireCastVoiceRecord(session, {
      castMemberId: input.castMemberId,
      voiceIdOrName: input.castVoiceId,
    });
    selectCastVoiceDefaultRecord(session, {
      castMemberId: input.castMemberId,
      castVoiceId: input.castVoiceId,
      now: new Date().toISOString(),
    });
    const resourceKeys = studioAssetOwnerSurfaceResourceKeys({
      kind: 'castMember',
      id: input.castMemberId,
    });
    return {
      valid: true,
      warnings: [],
      project: { id: currentProject.projectId, projectName: currentProject.projectName },
      castMemberId: input.castMemberId,
      selectedCastVoiceId: input.castVoiceId,
      voices: listCastVoicesInSession(session, input.castMemberId),
      resourceKeys,
    };
  });
}
