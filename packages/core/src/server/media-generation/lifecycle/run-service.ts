import { runGeneration } from '@gorenku/studio-engines';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  IMAGE_CREATE_GENERATION_PURPOSE,
  IMAGE_EDIT_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  MediaGenerationSpecRecord,
  MediaGenerationRunReport,
  ProjectRelativePath,
} from '../../../client/index.js';
import path from 'node:path';
import {
  insertMediaGenerationRun,
  requireMediaGenerationRun,
} from '../../database/access/media-generation.js';
import {
  listAssetFileRecordsForAsset,
  readAssetFileRecord,
} from '../../database/access/asset-files.js';
import { readCastMemberRecord } from '../../database/access/cast-members.js';
import { readLocationRecord } from '../../database/access/locations.js';
import { readScreenplayDocumentFromSession } from '../../database/access/screenplay-resource.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../entity-ids.js';
import {
  CAST_ROOT,
  LOCATIONS_ROOT,
  PROJECT_TMP_ROOT,
  VISUAL_LANGUAGE_ROOT,
  allocateProjectRelativeVersionedFilePath,
  extensionForMediaSource,
  kebabCasePathSegment,
  storyboardTemporarySheetRoot,
} from '../../files/asset-paths.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import type {
  RunMediaGenerationSpecInput,
  ReadMediaGenerationRunInput,
} from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import {
  mediaGenerationEstimateWithApproval,
  mediaGenerationRunApprovalToken,
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from '../cost/cost-approval.js';
import {
  estimateMediaGenerationSpecRecordCost,
} from '../cost/cost-projection.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';
import {
  prepareMediaGenerationSpec,
  readMediaGenerationSpec,
} from './spec-service.js';
import { withMediaGenerationProjectSession } from './project-session.js';

export async function runMediaGenerationSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readMediaGenerationSpec(input);
  if (specRecord.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return requireMediaGenerationPurposeDefinition(specRecord.purpose).runSpec(
      input
    ) as Promise<MediaGenerationRunReport>;
  }
  const prepared = await prepareMediaGenerationSpec(input);
  const estimate = await estimateMediaGenerationSpecRecordCost(prepared.spec);
  const mode = input.simulate ? 'simulated' : 'live';
  const costApproval = requireMediaGenerationCostApproval({
    mode,
    purpose: prepared.spec.purpose,
    estimate,
    approval: parseMediaGenerationRunCostApproval({
      approvalToken: input.approvalToken,
      approveUnpricedCost: input.approveUnpricedCost,
    }),
  });
  const outputPaths = await resolveSharedGenerationOutputPaths(input, specRecord);
  const result = await runGeneration({
    ...prepared.generation,
    mode,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  const now = new Date().toISOString();
  const run = await withMediaGenerationProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    return insertMediaGenerationRun(session, {
      id: ids('media_generation_run'),
      specId: prepared.spec.id,
      spec: prepared.spec.spec,
      provider: prepared.generation.policy.provider,
      model: prepared.generation.policy.model,
      providerPayload: prepared.providerPayload,
      estimate: mediaGenerationEstimateWithApproval(estimate, costApproval),
      approvalToken: mediaGenerationRunApprovalToken(costApproval),
      simulated: Boolean(input.simulate),
      status: input.simulate ? 'simulated' : 'completed',
      outputs: result.outputs,
      diagnostics: result.diagnostics ?? {},
      startedAt: now,
      completedAt: now,
    });
  });
  return { run };
}

export async function readMediaGenerationRun(
  input: ReadMediaGenerationRunInput
): Promise<MediaGenerationRunReport> {
  if (!input.runId?.trim()) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_RUN_ID_REQUIRED',
      'Media generation run id is required.'
    );
  }
  return withMediaGenerationProjectSession(input, ({ session }) => ({
    run: requireMediaGenerationRun(session, input.runId),
  }));
}

async function resolveSharedGenerationOutputPaths(
  input: RenkuConfigPathOptions,
  specRecord: MediaGenerationSpecRecord
) {
  return withMediaGenerationProjectSession(input, async ({ session, projectFolder }) => {
    const projectRelativeRoot = await sharedGenerationProjectRelativeRoot({
      session,
      projectFolder,
      specRecord,
    });
    return {
      absoluteRoot: resolveProjectRelativePath(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}

async function sharedGenerationProjectRelativeRoot(input: {
  session: Parameters<typeof readCastMemberRecord>[0];
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<ProjectRelativePath> {
  const spec = input.specRecord.spec as unknown as Record<string, unknown>;
  switch (input.specRecord.purpose) {
    case CAST_CHARACTER_SHEET_GENERATION_PURPOSE:
      return castMediaRoot(input.session, spec, 'character-sheets');
    case CAST_PROFILE_GENERATION_PURPOSE:
      return castMediaRoot(input.session, spec, 'profiles');
    case CAST_VOICE_SAMPLE_GENERATION_PURPOSE:
      return castMediaRoot(input.session, spec, 'voice-samples');
    case LOOKBOOK_IMAGE_GENERATION_PURPOSE:
    case LOOKBOOK_SHEET_GENERATION_PURPOSE:
      return joinProjectRelativePath(VISUAL_LANGUAGE_ROOT, 'lookbook');
    case LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE:
      return locationMediaRoot(input.session, spec, 'environment-sheets');
    case LOCATION_HERO_GENERATION_PURPOSE:
      return locationMediaRoot(input.session, spec, 'heroes');
    case SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return storyboardSheetOutputRoot(input.session, spec);
    case IMAGE_CREATE_GENERATION_PURPOSE:
    case SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE:
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'media');
    case IMAGE_EDIT_GENERATION_PURPOSE:
      return imageEditOutputRoot(input);
    default:
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_OUTPUT_PURPOSE_UNSUPPORTED',
        `Media generation output root is not defined for purpose: ${input.specRecord.purpose}.`
      );
  }
}

function castMediaRoot(
  session: Parameters<typeof readCastMemberRecord>[0],
  spec: Record<string, unknown>,
  folderName: string
): ProjectRelativePath {
  const castMemberId = targetId(spec);
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
      `Cast member was not found for media generation output root: ${castMemberId}.`
    );
  }
  return joinProjectRelativePath(CAST_ROOT, castMember.handle, folderName);
}

function locationMediaRoot(
  session: Parameters<typeof readLocationRecord>[0],
  spec: Record<string, unknown>,
  folderName: string
): ProjectRelativePath {
  const locationId = targetId(spec);
  const location = readLocationRecord(session, locationId);
  if (!location) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
      `Location was not found for media generation output root: ${locationId}.`
    );
  }
  return joinProjectRelativePath(LOCATIONS_ROOT, location.handle, folderName);
}

function storyboardSheetOutputRoot(
  session: Parameters<typeof readScreenplayDocumentFromSession>[0],
  spec: Record<string, unknown>
): ProjectRelativePath {
  const sceneId = targetId(spec);
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
      'Scene storyboard sheet output root requires a screenplay.'
    );
  }
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return storyboardTemporarySheetRoot({
            sequenceTitle: sequence.title ?? sequence.id ?? 'sequence',
            sceneTitle: scene.title ?? scene.id ?? 'scene',
          });
        }
      }
    }
  }
  throw new ProjectDataError(
    'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
    `Scene was not found for storyboard sheet output root: ${sceneId}.`
  );
}

async function imageEditOutputRoot(input: {
  session: Parameters<typeof readAssetFileRecord>[0];
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<ProjectRelativePath> {
  const spec = input.specRecord.spec as {
    target?: { id?: unknown };
    sourceAssetFileId?: unknown;
  };
  const assetId = typeof spec.target?.id === 'string' ? spec.target.id : '';
  const assetFileId =
    typeof spec.sourceAssetFileId === 'string' ? spec.sourceAssetFileId : '';
  if (!assetId) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
      'Image edit output root requires a source asset id.'
    );
  }
  const source = assetFileId
    ? readAssetFileRecord(input.session, { assetId, assetFileId })
    : singleActiveImageFile(input.session, assetId);
  if (!source) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
      `Image edit source asset file was not found for asset: ${assetId}.`
    );
  }
  const parsed = path.parse(source.projectRelativePath);
  const parent = parsed.dir as ProjectRelativePath;
  const candidate = await allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent,
    baseName: kebabCasePathSegment(parsed.name, 'image'),
    extension: extensionForMediaSource(source.projectRelativePath),
  });
  return path.dirname(candidate) as ProjectRelativePath;
}

function singleActiveImageFile(
  session: Parameters<typeof listAssetFileRecordsForAsset>[0],
  assetId: string
) {
  const imageFiles = listAssetFileRecordsForAsset(session, assetId).filter(
    (file) => file.mediaKind === 'image'
  );
  return imageFiles.length === 1 ? imageFiles[0]! : null;
}

function targetId(spec: Record<string, unknown>): string {
  const target = spec.target as { id?: unknown } | undefined;
  if (!target || typeof target.id !== 'string' || !target.id.trim()) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_OUTPUT_TARGET_MISSING',
      'Media generation output root requires a spec target id.'
    );
  }
  return target.id;
}
