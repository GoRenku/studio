import Ajv2020 from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
} from '@gorenku/studio-diagnostics';
import type {
  SceneShotVideoTakeGenerationCompatibilitySnapshot,
} from '../../client/shot-video-take-generation.js';
import type {
  ShotVideoTakeGenerationProduction,
} from '../../client/scene-shot-list.js';
import {
  sceneShotVideoTakeGenerationCompatibilitySnapshotSchema,
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
ajv.addSchema(sceneShotVideoTakeGenerationCompatibilitySnapshotSchema);

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
    path: ['takeGeneration', 'production'],
  });
  assertJsonShape({
    value: parsed,
    schemaId: shotVideoTakeGenerationProductionSchema.$id,
    code: 'PROJECT_DATA417',
    message: 'Stored shot video take generation production JSON failed validation.',
    path: ['takeGeneration', 'production'],
  });
  return parsed as ShotVideoTakeGenerationProduction;
}

export function serializeSceneShotVideoTakeGenerationCompatibilitySnapshot(
  input: { snapshot: SceneShotVideoTakeGenerationCompatibilitySnapshot }
): string {
  assertJsonShape({
    value: input.snapshot,
    schemaId: sceneShotVideoTakeGenerationCompatibilitySnapshotSchema.$id,
    code: 'PROJECT_DATA418',
    message:
      'Scene shot video take generation compatibility snapshot JSON failed validation.',
    path: ['compatibilitySnapshot'],
  });
  return JSON.stringify(input.snapshot);
}

export function parseSceneShotVideoTakeGenerationCompatibilitySnapshot(input: {
  value: string;
}): SceneShotVideoTakeGenerationCompatibilitySnapshot {
  const parsed = parseStoredJson(input.value, {
    code: 'PROJECT_DATA418',
    message:
      'Stored scene shot video take generation compatibility snapshot must be valid JSON.',
    path: ['takeGeneration', 'compatibilitySnapshot'],
  });
  assertJsonShape({
    value: parsed,
    schemaId: sceneShotVideoTakeGenerationCompatibilitySnapshotSchema.$id,
    code: 'PROJECT_DATA418',
    message:
      'Stored scene shot video take generation compatibility snapshot JSON failed validation.',
    path: ['takeGeneration', 'compatibilitySnapshot'],
  });
  return parsed as SceneShotVideoTakeGenerationCompatibilitySnapshot;
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
