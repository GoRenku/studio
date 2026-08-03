import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
  type DiagnosticResult,
} from '@gorenku/studio-diagnostics';
import type {
  Beat,
  SceneBeatSheetOperationDocument,
  SceneBeatSheetDocument,
  SceneStoryboardImagesImportDocument,
} from '../../client/scene-beats/index.js';
import {
  sceneBeatSheetDocumentSchema,
  sceneBeatSheetOperationDocumentSchema,
  sceneStoryboardImagesImportDocumentSchema,
} from '../../client/scene-beats/index.js';
import type { Scene, Screenplay } from '../../client/screenplay/index.js';

const BEAT_SHEET_DIAGNOSTIC_CODE = 'PROJECT_DATA320';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(sceneBeatSheetDocumentSchema);
ajv.addSchema(sceneBeatSheetOperationDocumentSchema);
ajv.addSchema(sceneStoryboardImagesImportDocumentSchema);

export function parseSceneBeatSheetDocument(input: {
  contents: string;
  filePath?: string;
}): SceneBeatSheetDocument {
  return parseJsonObject(
    input.contents,
    input.filePath
  ) as unknown as SceneBeatSheetDocument;
}

function parseJsonObject(contents: string, filePath?: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throwInvalidBeatSheetJson(filePath);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throwInvalidBeatSheetJson(filePath);
  }
  return parsed as Record<string, unknown>;
}

export function parseSceneBeatSheetOperationDocument(input: {
  contents: string;
  filePath?: string;
}): SceneBeatSheetOperationDocument {
  const parsed = parseJsonObject(input.contents, input.filePath);
  return parsed as unknown as SceneBeatSheetOperationDocument;
}

export function assertSceneBeatSheetOperationDocument(input: {
  document: SceneBeatSheetOperationDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const shapeIssues = validateShape({
    document: input.document,
    schemaId: sceneBeatSheetOperationDocumentSchema.$id,
    filePath: input.filePath,
  });
  const issues =
    shapeIssues.length > 0
      ? shapeIssues
      : [...shapeIssues, ...validateSceneBeatSheetOperationSemantics(input)];
  const result = buildDiagnosticResult(issues);
  throwIfDiagnosticResultInvalid(result, {
    code: BEAT_SHEET_DIAGNOSTIC_CODE,
    message: 'Scene Beat Sheet operations JSON failed validation.',
    suggestion:
      'Fix the reported Scene Beat Sheet operation issues and run the command again.',
  });
  return result.warnings;
}

export function assertSceneStoryboardImagesImportDocument(input: {
  document: SceneStoryboardImagesImportDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const shapeIssues = validateShape({
    document: input.document,
    schemaId: sceneStoryboardImagesImportDocumentSchema.$id,
    filePath: input.filePath,
  });
  const issues =
    shapeIssues.length > 0
      ? shapeIssues
      : [
          ...shapeIssues,
          ...validateSceneStoryboardImagesImportSemantics(input),
        ];
  const result = buildDiagnosticResult(issues);
  throwIfDiagnosticResultInvalid(result, {
    code: BEAT_SHEET_DIAGNOSTIC_CODE,
    message: 'Scene storyboard images import JSON failed validation.',
    suggestion:
      'Fix the reported Scene storyboard image import issues and run the command again.',
  });
  return result.warnings;
}

export function validateSceneBeatSheetDocument(input: {
  document: SceneBeatSheetDocument;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticResult {
  const shapeIssues = validateSceneBeatSheetShape(input.document, input.filePath);
  const issues =
    shapeIssues.length > 0
      ? shapeIssues
      : [...shapeIssues, ...validateSceneBeatSheetSemantics(input)];
  return buildDiagnosticResult(issues);
}

export function assertSceneBeatSheetDocument(input: {
  document: SceneBeatSheetDocument;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticIssue[] {
  const result = validateSceneBeatSheetDocument(input);
  throwIfDiagnosticResultInvalid(result, {
    code: BEAT_SHEET_DIAGNOSTIC_CODE,
    message: 'Scene Beat Sheet JSON failed validation.',
    suggestion: 'Fix the reported Scene Beat Sheet issues and run the command again.',
  });
  return result.warnings;
}

export function parseStoredSceneBeatSheetDocument(input: {
  value: string;
  screenplay: Screenplay;
  path?: string[];
}): SceneBeatSheetDocument {
  let parsed: SceneBeatSheetDocument;
  try {
    parsed = JSON.parse(input.value) as SceneBeatSheetDocument;
  } catch {
    throwIfDiagnosticResultInvalid(
      buildDiagnosticResult([
        createDiagnosticError(
          'PROJECT_DATA201',
          'Stored Scene Beat Sheet document must be valid JSON.',
          { path: input.path ?? ['sceneBeatSheet', 'document'] },
          'Repair the stored Scene Beat Sheet JSON.'
        ),
      ]),
      {
        code: 'PROJECT_DATA201',
        message: 'Stored Scene Beat Sheet JSON failed validation.',
        suggestion: 'Repair the stored Scene Beat Sheet JSON.',
      }
    );
    throw new Error('unreachable');
  }
  const result = validateSceneBeatSheetDocument({
    document: parsed,
    screenplay: input.screenplay,
  });
  throwIfDiagnosticResultInvalid(result, {
    code: BEAT_SHEET_DIAGNOSTIC_CODE,
    message: 'Stored Scene Beat Sheet JSON failed validation.',
    suggestion: 'Repair the stored Scene Beat Sheet JSON.',
  });
  return parsed;
}

export function serializeSceneBeatSheetDocument(input: {
  document: SceneBeatSheetDocument;
  screenplay: Screenplay;
  filePath?: string;
}): string {
  assertSceneBeatSheetDocument(input);
  return JSON.stringify(input.document);
}

function validateSceneBeatSheetShape(
  document: unknown,
  filePath?: string
): DiagnosticIssue[] {
  return validateShape({
    document,
    schemaId: sceneBeatSheetDocumentSchema.$id,
    filePath,
  });
}

function validateShape(input: {
  document: unknown;
  schemaId: string;
  filePath?: string;
}): DiagnosticIssue[] {
  const validator = ajv.getSchema(input.schemaId);
  if (!validator) {
    throw new Error(`JSON schema was not registered: ${input.schemaId}.`);
  }
  const valid = validator(input.document);
  return valid ? [] : mapAjvErrors(validator.errors ?? [], input.filePath);
}

function validateSceneBeatSheetSemantics(input: {
  document: SceneBeatSheetDocument;
  screenplay: Screenplay;
  filePath?: string;
}): DiagnosticIssue[] {
  const { document, screenplay, filePath } = input;
  const scene = findScene(screenplay, document.sceneId);
  const issues: DiagnosticIssue[] = [];
  if (!scene) {
    issues.push(
      error(
        'Scene Beat Sheet references an unknown scene.',
        ['sceneId'],
        filePath,
        'Use a scene id from `renku screenplay beat-sheet context --scene <id> --json`.'
      )
    );
    return issues;
  }

  const context = buildSceneValidationContext(screenplay, scene);
  const beatIds = new Set<string>();
  const coveredBlocks = new Set<string>();
  const screenplayBlockIds = new Set(scene.blocks.map((block) => block.id));
  document.beats.forEach((beat, beatIndex) => {
    const beatPath = ['beats', String(beatIndex)];
    if (beatIds.has(beat.id)) {
      issues.push(
        error(
          'Duplicate Beat id in Scene Beat Sheet.',
          [...beatPath, 'id'],
          filePath,
          'Use each Beat id only once within the Beat Sheet.'
        )
      );
    }
    beatIds.add(beat.id);
    validateNoAbsoluteOrGeneratedPaths(beat, beatPath, issues, filePath);
    beat.screenplayBlockIds.forEach((blockId, blockReferenceIndex) => {
      if (!screenplayBlockIds.has(blockId)) {
        issues.push(
          error(
            'Beat references an unknown screenplay block.',
            [
              ...beatPath,
              'screenplayBlockIds',
              String(blockReferenceIndex),
            ],
            filePath,
            'Use a screenplay block id from the current scene context.'
          )
        );
        return;
      }
      coveredBlocks.add(blockId);
    });
    if (beat.screenplayBlockIds.length === 0) {
      issues.push(
        warning(
          'Beat references no screenplay block.',
          [...beatPath, 'screenplayBlockIds'],
          filePath,
          'Connect the beat to the nearest scene block when possible.'
        )
      );
    }
    beat.castMemberIds.forEach((castMemberId, castIndex) => {
      if (!context.castMemberIds.has(castMemberId)) {
        issues.push(
          error(
            'Beat references an unknown cast member.',
            [...beatPath, 'castMemberIds', String(castIndex)],
            filePath,
            'Use a cast member id from the current project.'
          )
        );
      }
    });
    beat.locationIds.forEach((locationId, locationIndex) => {
      if (!context.locationIds.has(locationId)) {
        issues.push(
          error(
            'Beat references an unknown location.',
            [...beatPath, 'locationIds', String(locationIndex)],
            filePath,
            'Use a location id from the current project.'
          )
        );
      }
    });
    beat.propIds.forEach((propId, propIndex) => {
      if (!context.propIds.has(propId)) {
        issues.push(
          error(
            'Beat references an unknown prop.',
            [...beatPath, 'propIds', String(propIndex)],
            filePath,
            'Use a prop id referenced by the current scene.'
          )
        );
      }
    });
  });

  scene.blocks.forEach((block) => {
    if (
      (block.type === 'dialogue' || block.type === 'dualDialogue') &&
      !coveredBlocks.has(block.id)
    ) {
      issues.push(
        warning(
          'Beat Sheet leaves a dialogue block uncovered.',
          ['beats'],
          filePath,
          `Connect dialogue block ${block.id} to a Beat when appropriate.`
        )
      );
    }
  });
  return issues;
}

function validateSceneBeatSheetOperationSemantics(input: {
  document: SceneBeatSheetOperationDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  input.document.operations.forEach((operation, operationIndex) => {
    const path = ['operations', String(operationIndex)];
    if ('beats' in operation) {
      validateUniqueBeatIds(operation.beats, [...path, 'beats'], issues, input.filePath);
    }
    if ('beatIds' in operation) {
      validateUniqueStringValues(operation.beatIds, [...path, 'beatIds'], issues, input.filePath);
    }
  });
  return issues;
}

function validateSceneStoryboardImagesImportSemantics(input: {
  document: SceneStoryboardImagesImportDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  validateUniqueStringValues(
    input.document.beats.map((beat) => beat.beatId),
    ['beats'],
    issues,
    input.filePath
  );
  input.document.beats.forEach((beat, index) => {
    if ('sheet' in (beat as unknown as Record<string, unknown>)) {
      issues.push(
        error(
          'Scene storyboard images import must not include sheet sources.',
          ['beats', String(index), 'sheet'],
          input.filePath,
          'Import only cropped per-beat image files.'
        )
      );
    }
  });
  return issues;
}

function validateUniqueBeatIds(
  beats: Beat[],
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  validateUniqueStringValues(
    beats.map((beat) => beat.id),
    path,
    issues,
    filePath
  );
}

function validateUniqueStringValues(
  values: string[],
  path: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      issues.push(
        error(
          'Duplicate beat id.',
          [...path, String(index)],
          filePath,
          'Use each beat id only once in this document.'
        )
      );
    }
    seen.add(value);
  });
}

function buildSceneValidationContext(
  screenplay: Screenplay,
  scene: Scene
): {
  castMemberIds: Set<string>;
  locationIds: Set<string>;
  propIds: Set<string>;
} {
  const castMemberIds = new Set<string>();
  const locationIds = new Set<string>();
  const propIds = new Set<string>();
  for (const reference of screenplay.references) {
    if (!('sceneId' in reference.target) || reference.target.sceneId !== scene.id) {
      continue;
    }
    if (reference.subject.type === 'castMember') {
      castMemberIds.add(reference.subject.id);
    } else if (reference.subject.type === 'location') {
      locationIds.add(reference.subject.id);
    } else {
      propIds.add(reference.subject.id);
    }
  }
  return {
    castMemberIds,
    locationIds,
    propIds,
  };
}

function validateNoAbsoluteOrGeneratedPaths(
  beat: Beat,
  beatPath: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const fields: Array<[keyof Beat, string | undefined]> = [
    ['title', beat.title],
    ['narrativeDevelopment', beat.narrativeDevelopment],
    ['narrativePurpose', beat.narrativePurpose],
    ['description', beat.description],
  ];
  for (const [field, value] of fields) {
    if (!value) {
      continue;
    }
    if (containsDisallowedPath(value)) {
      issues.push(
        error(
          'Beat text must not store absolute paths or generated image paths.',
          [...beatPath, field],
          filePath,
          'Attach generated storyboard files through media import instead.'
        )
      );
    }
  }
}

function containsDisallowedPath(value: string): boolean {
  return (
    /(^|\s)(\/Users\/|\/private\/|\/var\/|\/tmp\/|[A-Za-z]:\\)/.test(value) ||
    value.includes('generated/media/')
  );
}

function findScene(
  screenplay: Screenplay,
  sceneId: string
): Scene | null {
  return screenplay.scenes.find((scene) => scene.id === sceneId) ?? null;
}

function throwInvalidBeatSheetJson(filePath?: string): never {
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult([
      createDiagnosticError(
        'PROJECT_DATA201',
        'Input must be a valid JSON object.',
        { path: [], ...(filePath ? { filePath } : {}) },
        'Provide a valid JSON object.'
      ),
    ]),
    {
      code: 'PROJECT_DATA201',
      message: 'Input must be a valid JSON object.',
      suggestion: 'Provide a valid JSON object.',
    }
  );
  throw new Error('unreachable');
}

function mapAjvErrors(
  errors: ErrorObject[],
  filePath?: string
): DiagnosticIssue[] {
  return errors
    .filter((validationError) => validationError.keyword !== 'if')
    .map((validationError) => {
      const path = pointerToPath(validationError.instancePath);
      if (validationError.keyword === 'required') {
        const missing = String(validationError.params.missingProperty);
        return error(
          `${missing} is required.`,
          [...path, missing],
          filePath,
          `Add the required ${missing} field.`
        );
      }
      if (validationError.keyword === 'additionalProperties') {
        const field = String(validationError.params.additionalProperty);
        return error(
          `Unknown field is not allowed: ${field}.`,
          [...path, field],
          filePath,
          'Remove the field or add it to the Scene Beat Sheet contract.'
        );
      }
      if (
        validationError.keyword === 'const' ||
        validationError.keyword === 'enum'
      ) {
        return error(
          `Unsupported value at ${formatPath(path)}.`,
          path,
          filePath,
          'Use one of the documented values.'
        );
      }
      return error(
        `Invalid value at ${formatPath(path)}.`,
        path,
        filePath,
        'Use the documented type and value range for this field.'
      );
    });
}

function error(
  message: string,
  path: string[],
  filePath?: string,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticError(
    BEAT_SHEET_DIAGNOSTIC_CODE,
    message,
    { path, ...(filePath ? { filePath } : {}) },
    suggestion
  );
}

function warning(
  message: string,
  path: string[],
  filePath?: string,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticWarning(
    BEAT_SHEET_DIAGNOSTIC_CODE,
    message,
    { path, ...(filePath ? { filePath } : {}) },
    suggestion
  );
}

function pointerToPath(pointer: string): string[] {
  if (!pointer) {
    return [];
  }
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function formatPath(path: string[]): string {
  return path.length > 0 ? path.join('.') : '<root>';
}
