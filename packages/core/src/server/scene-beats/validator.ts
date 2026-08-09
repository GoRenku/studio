import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  BeatInput,
  SceneBeatsInput,
  SceneBeatsOperationsInput,
  SceneStoryboardImagesImportDocument,
} from '../../client/scene-beats/index.js';
import {
  sceneBeatsInputSchema,
  sceneBeatsOperationsInputSchema,
  sceneStoryboardImagesImportDocumentSchema,
} from '../../client/scene-beats/index.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import { ProjectDataError } from '../project-data-error.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(sceneBeatsInputSchema);
ajv.addSchema(sceneBeatsOperationsInputSchema);
ajv.addSchema(sceneStoryboardImagesImportDocumentSchema);

export function parseSceneBeatsInput(input: {
  contents: string;
  filePath?: string;
}): SceneBeatsInput {
  return parseJsonObject(input.contents, input.filePath) as unknown as SceneBeatsInput;
}

export function parseSceneBeatsOperationsInput(input: {
  contents: string;
  filePath?: string;
}): SceneBeatsOperationsInput {
  return parseJsonObject(input.contents, input.filePath) as unknown as SceneBeatsOperationsInput;
}

export function assertSceneBeatsOperationsInput(input: {
  document: SceneBeatsOperationsInput;
  filePath?: string;
}): DiagnosticIssue[] {
  const warnings = assertShape(
    input.document,
    sceneBeatsOperationsInputSchema.$id,
    input.filePath,
    'Scene Beats operations JSON failed validation.'
  );
  input.document.operations.forEach((operation, operationIndex) => {
    if (operation.operation === 'beats.insert') {
      operation.beats.forEach((beat, beatIndex) => {
        validateReferencePaths(
          beat,
          ['operations', String(operationIndex), 'beats', String(beatIndex)],
          input.filePath
        );
      });
    }
    if (operation.operation === 'beat.update') {
      validateReferencePaths(
        operation.beat,
        ['operations', String(operationIndex), 'beat'],
        input.filePath
      );
    }
  });
  return warnings;
}

export function assertSceneStoryboardImagesImportDocument(input: {
  document: SceneStoryboardImagesImportDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const warnings = assertShape(
    input.document,
    sceneStoryboardImagesImportDocumentSchema.$id,
    input.filePath,
    'Scene storyboard images import JSON failed validation.'
  );
  const ids = input.document.beats.map((beat) => beat.beatId);
  if (new Set(ids).size !== ids.length) {
    throw invalidSceneBeats('Scene storyboard images import repeats a Beat id.');
  }
  return warnings;
}

export function assertSceneBeatsInput(input: {
  document: SceneBeatsInput;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticIssue[] {
  const warnings = assertShape(
    input.document,
    sceneBeatsInputSchema.$id,
    input.filePath,
    'Scene Beats JSON failed validation.'
  );
  const scene = input.screenplay.scenes.find((candidate) => candidate.id === input.document.sceneId);
  if (!scene) {
    throw invalidSceneBeats(`Scene was not found: ${input.document.sceneId}.`);
  }
  const screenplayBlockIds = new Set(scene.blocks.map((block) => block.id));
  input.document.beats.forEach((beat, index) => {
    validateReferencePaths(beat, ['beats', String(index)], input.filePath);
    beat.screenplayBlockIds.forEach((blockId, blockIndex) => {
      if (!screenplayBlockIds.has(blockId)) {
        warnings.push(createDiagnosticWarning(
          'SCENE_BEATS_SCREENPLAY_BLOCK_MISSING',
          `Beat references an unavailable Screenplay Block: ${blockId}.`,
          { path: ['beats', String(index), 'screenplayBlockIds', String(blockIndex)] }
        ));
      }
    });
  });
  return warnings;
}

function assertShape(
  document: unknown,
  schemaId: string,
  filePath: string | undefined,
  message: string
): DiagnosticIssue[] {
  const validator = ajv.getSchema(schemaId);
  if (!validator) {
    throw new Error(`JSON schema was not registered: ${schemaId}.`);
  }
  const result = buildDiagnosticResult(
    validator(document) ? [] : mapAjvErrors(validator.errors ?? [], filePath)
  );
  throwIfDiagnosticResultInvalid(result, {
    code: 'SCENE_BEATS_INVALID',
    message,
    suggestion: 'Fix every reported Scene Beats issue and run the command again.',
  });
  return result.warnings;
}

function parseJsonObject(contents: string, filePath?: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(contents);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Report the same structured document error below.
  }
  throw invalidSceneBeats(
    `Scene Beats input must be a JSON object${filePath ? `: ${filePath}` : ''}.`
  );
}

function validateReferencePaths(
  beat: BeatInput,
  path: string[],
  filePath?: string
): void {
  for (const [field, values] of Object.entries({
    castMemberIds: beat.castMemberIds,
    locationIds: beat.locationIds,
    propIds: beat.propIds,
    screenplayBlockIds: beat.screenplayBlockIds,
  })) {
    values.forEach((value, index) => {
      if (value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value)) {
        throw invalidSceneBeats(
          `Scene Beats references must use durable ids, not paths at ${[...path, field, String(index)].join('.')}${filePath ? ` in ${filePath}` : ''}.`
        );
      }
    });
  }
}

function mapAjvErrors(errors: ErrorObject[], filePath?: string): DiagnosticIssue[] {
  return errors.map((error) => createDiagnosticError(
    'SCENE_BEATS_INVALID',
    `Invalid Scene Beats value${error.message ? `: ${error.message}` : '.'}`,
    {
      path: error.instancePath.split('/').filter(Boolean),
      ...(filePath ? { file: filePath } : {}),
    }
  ));
}

function invalidSceneBeats(message: string): ProjectDataError {
  return new ProjectDataError('SCENE_BEATS_INVALID', message);
}
