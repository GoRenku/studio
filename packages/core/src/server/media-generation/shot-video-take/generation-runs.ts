import type {
  MediaGenerationRunReport,
  ShotVideoTakeOutputGenerationSpec,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  insertMediaGenerationRun,
} from '../../database/access/media-generation.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../entity-ids.js';
import type {
  RunMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import {
  assertShotVideoTakeSpec,
  estimateShotVideoTakeSpec,
  prepareShotVideoTakeSpec,
} from './final-specs.js';
import {
  resolveShotGenerationOutputPaths,
} from './generation-output-paths.js';
import {
  assertShotInputSpec,
  prepareShotInputSpec,
} from './input-specs.js';
import {
  withShotProjectSession,
} from './project-session.js';
import {
  buildShotVideoTakeContext,
} from './context.js';
import {
  assertEditableSceneShotVideoTake,
} from './take-context.js';
import {
  injectKlingTransientVoiceIds,
  resolveKlingTransientVoices,
} from './kling-transient-voice.js';
import {
  buildKlingTransientVoiceConversions,
} from './provider-payloads.js';
import {
  requireShotVideoTakeRoute,
} from './route-settings.js';
import {
  readShotSpec,
} from './spec-records.js';



export async function runShotInputSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareShotInputSpec(input);
  const spec = prepared.spec.spec;
  assertShotInputSpec(spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: spec.target.takeId,
  });
  assertEditableSceneShotVideoTake(context.take);
  const { estimateGeneration, runGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  const outputPaths = await resolveShotGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
  });
  return recordShotGenerationRun({
    ...input,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate,
    approvalToken: estimate.approvalToken,
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: result.diagnostics ?? {},
  });
}



export const runShotFirstFrameSpec = runShotInputSpec;


export const runShotLastFrameSpec = runShotInputSpec;


export const runShotReferenceImageSpec = runShotInputSpec;


export const runShotMultiShotStoryboardSheetSpec = runShotInputSpec;



export async function runShotVideoTakeSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareShotVideoTakeSpec(input);
  assertShotVideoTakeSpec(prepared.spec.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: prepared.spec.spec.target.takeId,
  });
  assertEditableSceneShotVideoTake(context.take);
  const { estimateGeneration, runGeneration } = await import('@gorenku/studio-engines');
  const combinedEstimate = await estimateShotVideoTakeSpec(input);
  if (!input.simulate && input.approvalToken !== combinedEstimate.estimate.approvalToken) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_APPROVAL_TOKEN_MISMATCH',
      'Shot Video Take run requires an approval token from the matching combined estimate.',
      {
        suggestion:
          'Run the estimate command again and pass its approval token to the run command.',
      }
    );
  }
  const outputPaths = await resolveShotGenerationOutputPaths(input);
  const transientVoiceDiagnostics = await prepareKlingTransientVoicePayload({
    commandInput: input,
    spec: prepared.spec.spec,
    providerPayload: prepared.providerPayload,
    requestParameters: prepared.generation.request.parameters,
    projectFolder: outputPaths.projectFolder,
    simulate: Boolean(input.simulate),
    estimateGeneration,
    runGeneration,
  });
  const finalRequestEstimate = await estimateGeneration(prepared.generation);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: finalRequestEstimate.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  return recordShotGenerationRun({
    ...input,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate: combinedEstimate.estimate,
    approvalToken: combinedEstimate.estimate.approvalToken,
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: {
      ...(isRecord(result.diagnostics) ? result.diagnostics : {}),
      ...(transientVoiceDiagnostics
        ? { klingTransientVoiceConversions: transientVoiceDiagnostics }
        : {}),
    },
  });
}

async function prepareKlingTransientVoicePayload(input: {
  commandInput: RunMediaGenerationSpecInput;
  spec: unknown;
  providerPayload: Record<string, unknown>;
  requestParameters: Record<string, unknown>;
  projectFolder: string;
  simulate: boolean;
  estimateGeneration: typeof import('@gorenku/studio-engines').estimateGeneration;
  runGeneration: typeof import('@gorenku/studio-engines').runGeneration;
}): Promise<Record<string, unknown> | null> {
  const spec = input.spec as ShotVideoTakeOutputGenerationSpec;
  const context = await buildShotVideoTakeContext({
    projectName: input.commandInput.projectName,
    homeDir: input.commandInput.homeDir,
    takeId: spec.target.takeId,
  });
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  const conversions = buildKlingTransientVoiceConversions({
    spec,
    route,
    payload: input.providerPayload,
  });
  if (conversions.length === 0) {
    return null;
  }
  const report = await resolveKlingTransientVoices({
    projectFolder: input.projectFolder,
    conversions,
    simulate: input.simulate,
    estimateGeneration: input.estimateGeneration,
    runGeneration: input.runGeneration,
  });
  injectKlingTransientVoiceIds({
    payload: input.providerPayload,
    requestParameters: input.requestParameters,
    resolutions: report.resolutions,
  });
  return {
    cacheWarnings: report.warnings,
    conversions: report.resolutions.map((resolution) => ({
      provider: resolution.conversion.provider,
      model: resolution.conversion.model,
      sourceAudioAssetFileId: resolution.conversion.sourceAudio.assetFileId,
      sourceProjectPath: resolution.conversion.sourceAudio.projectRelativePath,
      sourceAudioFingerprint: resolution.sourceAudioFingerprint,
      targetElementId: resolution.conversion.targetElementId,
      targetPromptToken: resolution.conversion.targetPromptToken,
      payloadPath: resolution.conversion.payloadPath,
      cacheResult: resolution.cacheResult,
      expiresAt: resolution.expiresAt,
      simulated: resolution.simulated,
    })),
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}



export async function recordShotGenerationRun(
  input: RunMediaGenerationSpecInput & {
    provider: 'fal-ai' | 'elevenlabs';
    model: string;
    providerPayload: Record<string, unknown>;
    estimate: unknown;
    approvalToken?: string;
    simulated: boolean;
    status: 'simulated' | 'completed' | 'failed';
    outputs: unknown;
    diagnostics: unknown;
  }
): Promise<MediaGenerationRunReport> {
  const specRecord = await readShotSpec(input);
  const now = new Date().toISOString();
  const run = await withShotProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationRun(session, {
      id: ids('media_generation_run'),
      specId: specRecord.id,
      spec: specRecord.spec,
      provider: input.provider,
      model: input.model,
      providerPayload: input.providerPayload,
      estimate: input.estimate,
      approvalToken: input.approvalToken,
      simulated: input.simulated,
      status: input.status,
      outputs: input.outputs,
      diagnostics: input.diagnostics,
      startedAt: now,
      completedAt: now,
    });
  });
  return { run };
}
