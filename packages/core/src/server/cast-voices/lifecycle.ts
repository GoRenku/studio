import type { CastVoiceRemoveReport } from '../../client/cast-voices.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { readCastVoiceRecordBySampleAssetFileId } from '../database/access/cast-voices.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioAssetFileOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
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
    const sample = readOwnedAssetFile(session, { owner: target, assetFileId: record.sampleAssetFileId });
    if (!sample) {
      throw new ProjectDataError(
        'PROJECT_DATA352',
        `Cast Voice sample asset is missing: ${record.sampleAssetFileId}.`
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
        sampleAssetFileId: record.sampleAssetFileId,
      },
      changes: [{ type: 'castVoice.removed', castMemberId: input.castMemberId, voiceId: record.id }],
      recovery: report.recovery,
      resourceKeys: studioAssetFileOwnerSurfaceResourceKeys(target),
    };
  });
}

export function assertAssetFileIsNotCastVoiceSample(
  session: Parameters<typeof readCastVoiceRecordBySampleAssetFileId>[0],
  assetFileId: string
): void {
  const voice = readCastVoiceRecordBySampleAssetFileId(session, assetFileId);
  if (!voice) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA353',
    `Asset ${assetFileId} is linked to Cast Voice ${voice.id} and cannot be deleted directly.`,
    { suggestion: 'Remove the Cast Voice first.' }
  );
}
