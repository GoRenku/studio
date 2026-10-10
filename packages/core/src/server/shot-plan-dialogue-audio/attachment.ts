import type { AssetFileMetadataInput } from '../../client/asset-files.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import type {
  DialogueTurnRange,
  ShotPlanDialogueAudioAttachmentReport,
} from '../../client/shot-plan-dialogue-audio.js';
import { normalizeAssetFileMetadata } from '../asset-files/metadata.js';
import { validateMediaGenerationProvenance } from '../asset-files/generation-provenance.js';
import {
  clearOverlappingShotPlanDialogueAudioTakeSelections,
  insertShotPlanDialogueAudioTakeRecord,
} from '../database/access/shot-plan-dialogue-audio.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { persistOwnedGeneratedMediaAssetFileInSession } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { readShotPlanDialogueAudio } from './projection.js';
import { validateDialogueTurnRange } from './validation.js';

export function attachShotPlanDialogueAudio(input: {
  session: DatabaseSession;
  projectFolder: string;
  shotPlanId: string;
  sourceProjectRelativePath: string;
  turnRange: DialogueTurnRange;
  generationProvenance: MediaGenerationProvenance;
  title?: string;
  assetFileMetadata?: AssetFileMetadataInput;
  idGenerator: ProjectIdGenerator;
}): ShotPlanDialogueAudioAttachmentReport {
  const shotPlan = requireShotPlanRecord(input.session, input.shotPlanId);
  const turnRange = validateDialogueTurnRange(input.turnRange);
  const generationProvenance = validateMediaGenerationProvenance(input.generationProvenance);
  if (generationProvenance.mediaKind !== 'audio') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'Shot Plan Dialogue Audio provenance must describe audio.'
    );
  }
  const assetFileId = input.idGenerator.next('asset_file');
  const takeId = input.idGenerator.next('shot_plan_dialogue_audio_take');
  const now = new Date().toISOString();
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      persistOwnedGeneratedMediaAssetFileInSession({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetFileId,
        now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: {
          kind: 'shotPlan.dialogueAudio',
          shotPlanId: shotPlan.id,
          turnStartNumber: turnRange.start,
          turnEndNumber: turnRange.end,
        },
        owner: { kind: 'project' },
        assetFileMetadata: {
          type: 'shot_plan_dialogue_audio',
          mediaKind: 'audio',
          title: input.title?.trim() || rangeTitle(turnRange),
          ...normalizeAssetFileMetadata(input.assetFileMetadata ?? {}),
          origin: 'generated',
        },
        generationProvenance,
        authoredFromShotPlanId: shotPlan.id,
      });
      insertShotPlanDialogueAudioTakeRecord(session, {
        id: takeId,
        shotPlanId: shotPlan.id,
        assetFileId,
        turnStartNumber: turnRange.start,
        turnEndNumber: turnRange.end,
        selectedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      clearOverlappingShotPlanDialogueAudioTakeSelections(session, {
        shotPlanId: shotPlan.id,
        exceptTakeId: takeId,
        turnStartNumber: turnRange.start,
        turnEndNumber: turnRange.end,
        updatedAt: now,
      });
      writeSet.markCommitted();
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  const resource = readShotPlanDialogueAudio({ session: input.session, shotPlanId: shotPlan.id });
  const assetFile = resource.takes.find((take) => take.id === takeId)?.assetFile;
  if (!assetFile) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Shot Plan Dialogue Audio attachment was not persisted.',
    );
  }
  return {
    valid: true,
    warnings: [],
    resource,
    assetFile,
    resourceKeys: resource.resourceKeys,
  };
}

function rangeTitle(range: DialogueTurnRange): string {
  return range.start === range.end
    ? `Turn ${range.start} Dialogue Audio`
    : `Turns ${range.start}-${range.end} Dialogue Audio`;
}
