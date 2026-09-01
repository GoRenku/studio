import type { CastVoiceRemoveReport } from '../../client/cast-voices.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readCastVoiceRecordBySampleAssetId } from '../database/access/cast-voices.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioAssetOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { requireCastMember, requireCastVoiceRecord, type CastVoiceLookupInput } from './projection.js';
import { withCastVoiceProjectSession } from './project-session.js';

export async function removeCastVoice(
  input: CastVoiceLookupInput
): Promise<CastVoiceRemoveReport> {
  return withCastVoiceProjectSession(input, ({ currentProject, projectFolder, session }) => {
    requireCastMember(session, input.castMemberId);
    const record = requireCastVoiceRecord(session, input);
    const target = { kind: 'castMember' as const, id: input.castMemberId };
    const sample = readOwnedAsset(session, { owner: target, assetId: record.sampleAssetId });
    if (!sample) {
      throw new ProjectDataError(
        'PROJECT_DATA352',
        `Cast Voice sample asset is missing: ${record.sampleAssetId}.`
      );
    }
    const report = discardTrashObject({
      session,
      project: { id: currentProject.projectId, projectName: currentProject.projectName },
      projectFolder,
      itemKind: 'castVoice',
      itemId: record.id,
      commandName: 'castVoice.discard',
      changes: [{ type: 'castVoice.removed', castMemberId: input.castMemberId, voiceId: record.id }],
    });
    return {
      project: { id: currentProject.projectId, projectName: currentProject.projectName },
      removed: {
        castMemberId: input.castMemberId,
        voiceId: record.id,
        sampleAssetId: record.sampleAssetId,
      },
      changes: [{ type: 'castVoice.removed', castMemberId: input.castMemberId, voiceId: record.id }],
      recovery: report.recovery,
      resourceKeys: studioAssetOwnerSurfaceResourceKeys(target),
    };
  });
}

export function assertAssetIsNotCastVoiceSample(
  session: Parameters<typeof readCastVoiceRecordBySampleAssetId>[0],
  assetId: string
): void {
  const voice = readCastVoiceRecordBySampleAssetId(session, assetId);
  if (!voice) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA353',
    `Asset ${assetId} is linked to Cast Voice ${voice.id} and cannot be deleted directly.`,
    { suggestion: 'Remove the Cast Voice first.' }
  );
}
