import { createDiagnosticError, createStructuredError } from '@gorenku/studio-diagnostics';
import type { SceneDialogueAudioSetup } from '@gorenku/studio-core/client';
import { readHttpRequestRecord } from '../request-validation.js';

const CONTEXT = 'Scene Dialogue Audio request';

export function readSceneDialogueAudioSetupRequest(input: unknown): Partial<SceneDialogueAudioSetup> {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) throw invalidRequest(issues);
  const setup = optionalSetup(record);
  if (issues.length > 0) throw invalidRequest(issues);
  return setup;
}

function optionalSetup(record: Record<string, unknown>): Partial<SceneDialogueAudioSetup> {
  return {
    ...(typeof record.modelChoice === 'string' ? { modelChoice: record.modelChoice as SceneDialogueAudioSetup['modelChoice'] } : {}),
    ...(typeof record.castVoiceId === 'string' ? { castVoiceId: record.castVoiceId } : {}),
    ...(typeof record.plainText === 'string' ? { plainText: record.plainText } : {}),
    ...(typeof record.v3Text === 'string' ? { v3Text: record.v3Text } : {}),
    ...(record.voiceSettings && typeof record.voiceSettings === 'object' ? { voiceSettings: record.voiceSettings as SceneDialogueAudioSetup['voiceSettings'] } : {}),
    ...(typeof record.outputFormat === 'string' ? { outputFormat: record.outputFormat } : {}),
    ...(typeof record.languageCode === 'string'
      ? { languageCode: record.languageCode }
      : record.languageCode === null ? { languageCode: null } : {}),
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
