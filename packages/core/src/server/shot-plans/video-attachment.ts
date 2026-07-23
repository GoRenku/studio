import type {
  GenerationPurpose,
  GenerationTarget,
} from '../../client/generation.js';
import { readAssetFileRecord } from '../database/access/asset-files.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  attachShotPlanVideoAsset,
  requireShotPlanRecord,
} from '../database/access/shot-plans.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import type {
  GenerationMediaAttachmentReport,
  ValidatedGenerationProvenance,
} from '../generation/attachments.js';
import { persistGeneratedMediaAssetInSession } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { studioSceneShotsResourceKey } from '../studio-coordination/resource-keys.js';

export function attachShotPlanVideo(input: {
  purpose: GenerationPurpose;
  target: Extract<GenerationTarget, { kind: 'shotPlan' }>;
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
  session: DatabaseSession;
  projectFolder: string;
  idGenerator: ProjectIdGenerator;
  provenance: ValidatedGenerationProvenance;
}): GenerationMediaAttachmentReport {
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const now = new Date().toISOString();
  const writeSet = createProjectAssetFileWriteSet({
    projectFolder: input.projectFolder,
  });
  let sceneId = '';
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      const shotPlan = requireShotPlanRecord(session, input.target.id);
      sceneId = shotPlan.sceneId;
      if (shotPlan.videoAssetId !== null) {
        throw new ProjectDataError(
          'CORE_SHOT_PLAN_VIDEO_EXISTS',
          `Shot Plan already has a final video Asset: ${shotPlan.id}.`
        );
      }
      if (
        input.provenance !== null &&
        shotPlan.generationSpecId !== input.provenance.generationSpecId
      ) {
        throw new ProjectDataError(
          'CORE_SHOT_PLAN_GENERATION_SPEC_INVALID',
          `Attachment provenance does not use the current Generation Spec for Shot Plan ${shotPlan.id}.`
        );
      }
      persistGeneratedMediaAssetInSession({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: {
          kind: 'shotPlan.video',
          shotPlanId: shotPlan.id,
        },
        asset: {
          type: 'shot-plan-video',
          mediaKind: 'video',
          title: input.title?.trim() || 'Shot Plan Video',
          origin: input.provenance ? 'generated' : 'external',
        },
        fileRole: 'primary',
        ...(input.provenance?.kind === 'renku-managed'
          ? {
              selectedGenerationOutput: {
                generationRunId: input.provenance.generationRunId,
                outputArtifactId: input.provenance.outputArtifactId,
              },
            }
          : {}),
        ...(input.provenance?.kind === 'agent-external'
          ? { sourceSpecId: input.provenance.generationSpecId }
          : {}),
      });
      attachShotPlanVideoAsset(session, {
        shotPlanId: shotPlan.id,
        videoAssetId: assetId,
        now,
      });
    });
    writeSet.markCommitted();
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  const project = readProjectRecord(input.session);
  const file = readAssetFileRecord(input.session, { assetId, assetFileId });
  if (!project || !file) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_FAILED',
      'Shot Plan video attachment was not persisted.'
    );
  }
  return {
    valid: true,
    purpose: input.purpose,
    target: input.target,
    asset: {
      assetId,
      assetFileId,
      projectRelativePath: file.projectRelativePath,
    },
    provenance:
      input.provenance?.kind === 'renku-managed'
        ? { generationRunId: input.provenance.generationRunId }
        : input.provenance?.kind === 'agent-external'
          ? { generationSpecId: input.provenance.generationSpecId }
          : null,
    resourceKeys: [studioSceneShotsResourceKey(sceneId)],
    project: {
      name: project.name,
      id: project.id,
      projectFolder: input.projectFolder,
    },
  };
}
