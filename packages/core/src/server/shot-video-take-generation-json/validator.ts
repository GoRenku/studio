import Ajv2020 from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
} from '@gorenku/studio-diagnostics';
import type {
  SceneShotVideoTakeHistorySnapshot,
  SceneShotVideoTakeState,
} from '../../client/shot-video-take-generation.js';
import type {
  ShotVideoTakeGenerationProduction,
} from '../../client/scene-shot-list.js';
import {
  sceneShotVideoTakeStateSchema,
  sceneShotVideoTakeHistorySnapshotSchema,
  shotVideoTakeGenerationProductionSchema,
} from '../../client/scene-shot-list-json-schemas.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(shotVideoTakeGenerationProductionSchema);
ajv.addSchema(sceneShotVideoTakeHistorySnapshotSchema);
ajv.addSchema(sceneShotVideoTakeStateSchema);

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

export function serializeShotVideoTakeGenerationProduction(input: {
  production: ShotVideoTakeGenerationProduction;
}): string {
  assertJsonShape({
    value: input.production,
    schemaId: shotVideoTakeGenerationProductionSchema.$id,
    code: 'PROJECT_DATA417',
    message: 'Shot video take generation production JSON failed validation.',
    path: ['production'],
  });
  return JSON.stringify(input.production);
}

export function parseShotVideoTakeGenerationProduction(input: {
  value: string;
}): ShotVideoTakeGenerationProduction {
  const parsed = parseStoredJson(input.value, {
    code: 'PROJECT_DATA417',
    message: 'Stored shot video take generation production must be valid JSON.',
    path: ['take', 'production'],
  });
  assertJsonShape({
    value: parsed,
    schemaId: shotVideoTakeGenerationProductionSchema.$id,
    code: 'PROJECT_DATA417',
    message: 'Stored shot video take generation production JSON failed validation.',
    path: ['take', 'production'],
  });
  return parsed as ShotVideoTakeGenerationProduction;
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
  });
}

function failJsonValidation(error: {
  code: string;
  message: string;
  path: string[];
}): never {
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult([
      createDiagnosticError(
        error.code,
        error.message,
        { path: error.path },
        'Repair the stored shot video take generation JSON.'
      ),
    ]),
    {
      code: error.code,
      message: error.message,
      suggestion: 'Repair the stored shot video take generation JSON.',
    }
  );
  throw new Error('unreachable');
}
