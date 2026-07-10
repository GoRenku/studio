import { createDiagnosticError, createStructuredError } from '@gorenku/studio-diagnostics';
import type { SceneDialogueAudioGenerationSpec } from '@gorenku/studio-core/client';
import { readHttpRequestRecord } from './request-validation.js';

const CONTEXT = 'Scene Dialogue Audio request';

export function readSceneDialogueAudioSetupRequest(
  input: unknown
): Partial<SceneDialogueAudioGenerationSpec> {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throw invalidRequest(issues);
  }
  const setup = optionalSetup(record);
  if (issues.length > 0) {
    throw invalidRequest(issues);
  }
  return setup;
}

export function readSceneDialogueAudioGenerateRequest(input: unknown): {
  setup: Partial<SceneDialogueAudioGenerationSpec>;
  simulate?: boolean;
  approveLiveProviderRun?: boolean;
} {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throw invalidRequest(issues);
  }
  const setup = optionalSetup(
    typeof record.setup === 'object' && record.setup !== null
      ? (record.setup as Record<string, unknown>)
      : record
  );
  return {
    setup,
    ...(typeof record.simulate === 'boolean' ? { simulate: record.simulate } : {}),
    ...(typeof record.approveLiveProviderRun === 'boolean'
      ? { approveLiveProviderRun: record.approveLiveProviderRun }
      : {}),
  };
}

export function readSceneDialogueAudioEstimateRequest(
  input: unknown
): SceneDialogueAudioGenerationSpec {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throw invalidRequest(issues);
  }
  const spec = record.spec;
  if (!spec || typeof spec !== 'object') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER120',
        'Scene Dialogue Audio estimate requires spec.',
        { path: ['spec'], context: CONTEXT },
        'Send a complete Scene Dialogue Audio generation spec.'
      )
    );
  }
  if (issues.length > 0) {
    throw invalidRequest(issues);
  }
  return spec as SceneDialogueAudioGenerationSpec;
}

function optionalSetup(
  record: Record<string, unknown>
): Partial<SceneDialogueAudioGenerationSpec> {
  return {
    ...(typeof record.modelChoice === 'string'
      ? { modelChoice: record.modelChoice as SceneDialogueAudioGenerationSpec['modelChoice'] }
      : {}),
    ...(typeof record.castVoiceId === 'string' ? { castVoiceId: record.castVoiceId } : {}),
    ...(typeof record.plainText === 'string' ? { plainText: record.plainText } : {}),
    ...(typeof record.v3Text === 'string' ? { v3Text: record.v3Text } : {}),
    ...(record.voiceSettings && typeof record.voiceSettings === 'object'
      ? { voiceSettings: record.voiceSettings as SceneDialogueAudioGenerationSpec['voiceSettings'] }
      : {}),
    ...(typeof record.outputFormat === 'string' ? { outputFormat: record.outputFormat } : {}),
    ...(typeof record.languageCode === 'string'
      ? { languageCode: record.languageCode }
      : record.languageCode === null
        ? { languageCode: null }
        : {}),
  };
}

function invalidRequest(issues: ReturnType<typeof createDiagnosticError>[]) {
  return createStructuredError({
    code: 'STUDIO_SERVER120',
    message: 'Invalid Scene Dialogue Audio request.',
    issues,
    suggestion: 'Send the expected Scene Dialogue Audio request body.',
  });
}
