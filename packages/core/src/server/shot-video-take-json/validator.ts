import Ajv2020 from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
} from '@gorenku/studio-diagnostics';
import type {
  SceneShotVideoTakeAuthoringDocument,
  SceneShotVideoTakeHistorySnapshot,
  SceneShotVideoTakeState,
} from '../../client/shot-video-take.js';
import {
  sceneShotVideoTakeAuthoringDocumentSchema,
  sceneShotVideoTakeStateSchema,
  sceneShotVideoTakeHistorySnapshotSchema,
} from '../../client/scene-shot-list-json-schemas.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(sceneShotVideoTakeHistorySnapshotSchema);
ajv.addSchema(sceneShotVideoTakeStateSchema);
ajv.addSchema(sceneShotVideoTakeAuthoringDocumentSchema);

export function serializeSceneShotVideoTakeState(input: {
  state: SceneShotVideoTakeState;
}): string {
  assertJsonShape({
    value: input.state,
    schemaId: sceneShotVideoTakeStateSchema.$id,
    code: 'PROJECT_DATA421',
    message: 'Scene shot video take state JSON failed validation.',
    path: ['state'],
  });
  return JSON.stringify(input.state);
}

export function parseSceneShotVideoTakeState(input: {
  value: string;
}): SceneShotVideoTakeState {
  const parsed = parseStoredJson(input.value, {
    code: 'PROJECT_DATA421',
    message: 'Stored scene shot video take state must be valid JSON.',
    path: ['take', 'state'],
  });
  assertJsonShape({
    value: parsed,
    schemaId: sceneShotVideoTakeStateSchema.$id,
    code: 'PROJECT_DATA421',
    message: 'Stored scene shot video take state JSON failed validation.',
    path: ['take', 'state'],
  });
  return parsed as SceneShotVideoTakeState;
}

export function serializeSceneShotVideoTakeHistorySnapshot(
  input: { snapshot: SceneShotVideoTakeHistorySnapshot }
): string {
  assertJsonShape({
    value: input.snapshot,
    schemaId: sceneShotVideoTakeHistorySnapshotSchema.$id,
    code: 'PROJECT_DATA418',
    message:
      'Scene shot video take history snapshot JSON failed validation.',
    path: ['historySnapshot'],
  });
  return JSON.stringify(input.snapshot);
}

export function parseSceneShotVideoTakeHistorySnapshot(input: {
  value: string;
}): SceneShotVideoTakeHistorySnapshot {
  const parsed = parseStoredJson(input.value, {
    code: 'PROJECT_DATA418',
    message:
      'Stored scene shot video take history snapshot must be valid JSON.',
    path: ['take', 'historySnapshot'],
  });
  assertJsonShape({
    value: parsed,
    schemaId: sceneShotVideoTakeHistorySnapshotSchema.$id,
    code: 'PROJECT_DATA418',
    message:
      'Stored scene shot video take history snapshot JSON failed validation.',
    path: ['take', 'historySnapshot'],
  });
  return parsed as SceneShotVideoTakeHistorySnapshot;
}

export function assertSceneShotVideoTakeAuthoringDocument(input: {
  document: unknown;
}): asserts input is { document: SceneShotVideoTakeAuthoringDocument } {
  assertJsonShape({
    value: input.document,
    schemaId: sceneShotVideoTakeAuthoringDocumentSchema.$id,
    code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_DOCUMENT',
    message: 'Scene Shot Video Take authoring document failed validation.',
    path: ['document'],
    suggestion:
      'Rewrite the authoring document using the current SceneShotVideoTakeAuthoringDocument schema.',
  });
}

function parseStoredJson(
  value: string,
  error: { code: string; message: string; path: string[] }
): unknown {
  try {
    return JSON.parse(value);
  } catch {
    failJsonValidation(error);
  }
}

function assertJsonShape(input: {
  value: unknown;
  schemaId: string;
  code: string;
  message: string;
  path: string[];
  suggestion?: string;
}): void {
  const validator = ajv.getSchema(input.schemaId);
  if (!validator) {
    throw new Error(`JSON schema was not registered: ${input.schemaId}.`);
  }
  if (validator(input.value)) {
    return;
  }
  failJsonValidation({
    code: input.code,
    message: input.message,
    path: input.path,
    suggestion: input.suggestion,
  });
}

function failJsonValidation(error: {
  code: string;
  message: string;
  path: string[];
  suggestion?: string;
}): never {
  const suggestion = error.suggestion ?? 'Repair the stored Shot Video Take JSON.';
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult([
      createDiagnosticError(
        error.code,
        error.message,
        { path: error.path },
        suggestion
      ),
    ]),
    {
      code: error.code,
      message: error.message,
      suggestion,
    }
  );
  throw new Error('unreachable');
}
