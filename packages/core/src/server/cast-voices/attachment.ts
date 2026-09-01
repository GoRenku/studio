import type {
  CastVoiceAttachmentReport,
  CastVoiceFileAttachmentDocument,
  CastVoiceValidationReport,
} from '../../client/cast-voices.js';
import { createAssetMembership } from '../assets/ownership.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  insertCastVoiceRecord,
  nextCastVoiceSortOrder,
  readCastVoiceRecord,
  readCastVoiceDefaultRecord,
  selectCastVoiceDefaultRecord,
} from '../database/access/cast-voices.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioAssetOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
import { toCastVoice } from './projection.js';
import { withCastVoiceProjectSession, type CastVoiceProjectInput } from './project-session.js';
import { validateCastVoiceFileAttachment } from './validation.js';

export interface CastVoiceAttachmentInput extends CastVoiceProjectInput {
  document: CastVoiceFileAttachmentDocument;
  idGenerator?: ProjectIdGenerator;
}

export async function validateCastVoiceAttachment(
  input: CastVoiceAttachmentInput
): Promise<CastVoiceValidationReport> {
  return withCastVoiceProjectSession(input, async ({ projectFolder, session }) => {
    await validateCastVoiceFileAttachment({ projectFolder, session, document: input.document });
    return { valid: true, warnings: [] };
  });
}

export async function attachCastVoice(
  input: CastVoiceAttachmentInput
): Promise<CastVoiceAttachmentReport> {
  return withCastVoiceProjectSession(
    input,
    async ({ currentProject, projectFolder, session }) => {
      const validated = await validateCastVoiceFileAttachment({
        projectFolder,
        session,
        document: input.document,
      });
      const now = new Date().toISOString();
      const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
      const assetId = ids('asset');
      const assetFileId = ids('asset_file');
      const voiceId = ids('cast_voice');
      const target = { kind: 'castMember' as const, id: validated.castMember.id };
      const writeSet = createProjectAssetFileWriteSet({ projectFolder });
      try {
        session.db.transaction((tx) => {
          const txSession = { ...session, db: tx };
          insertAssetRecord(txSession, {
            id: assetId,
            type: 'cast_voice_sample',
            mediaKind: 'audio',
            title: validated.sampleTitle,
            referenceName: validated.name,
            tags: [validated.purpose],
            origin: validated.generationProvenance ? 'generated' : 'imported',
            availability: 'ready',
            ...(validated.generationProvenance
              ? { generationProvenance: validated.generationProvenance }
              : {}),
            createdAt: now,
            updatedAt: now,
          });
          persistProjectAssetFileSync({
            session: txSession,
            projectFolder,
            writeSet,
            assetId,
            assetFileId,
            sourceProjectRelativePath: validated.sourceProjectRelativePath,
            destination: {
              kind: 'cast.voiceSample',
              castMemberId: validated.castMember.id,
              castVoiceId: voiceId,
              referenceName: validated.name,
            },
            namingMode: validated.generationProvenance
              ? { kind: 'generated' }
              : { kind: 'external' },
            fileRole: 'primary',
            mediaKind: 'audio',
            mimeType: validated.mimeType,
            now,
          });
          createAssetMembership(txSession, { assetId, owner: target, now });
          insertCastVoiceRecord(txSession, {
            id: voiceId,
            castMemberId: validated.castMember.id,
            name: validated.name,
            purpose: validated.purpose,
            sampleAssetId: assetId,
            voiceIdentity: validated.voiceIdentity,
            sortOrder: nextCastVoiceSortOrder(txSession, validated.castMember.id),
            createdAt: now,
            updatedAt: now,
          });
          if (!readCastVoiceDefaultRecord(txSession, validated.castMember.id)) {
            selectCastVoiceDefaultRecord(txSession, {
              castMemberId: validated.castMember.id,
              castVoiceId: voiceId,
              now,
            });
          }
        });
        commitProjectAssetFileWriteSet(writeSet);
      } catch (error) {
        rollbackProjectAssetFileWriteSetSync(writeSet);
        throw error;
      }
      const record = readCastVoiceRecord(session, {
        castMemberId: validated.castMember.id,
        voiceIdOrName: voiceId,
      });
      if (!record) {
        throw new ProjectDataError('PROJECT_DATA350', `Cast Voice was not persisted: ${voiceId}.`);
      }
      const voice = toCastVoice(session, record);
      return {
        valid: true,
        warnings: [],
        project: { id: currentProject.projectId, projectName: currentProject.projectName },
        castMember: {
          id: validated.castMember.id,
          handle: validated.castMember.handle,
          name: validated.castMember.name,
        },
        voice,
        changes: [{ type: 'castVoice.attached', castMemberId: validated.castMember.id, voiceId }],
        resourceKeys: studioAssetOwnerSurfaceResourceKeys(target),
      };
    }
  );
}
