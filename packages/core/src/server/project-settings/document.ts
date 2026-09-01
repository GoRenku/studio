import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectSettingsDocument } from '../../client/project-settings.js';
import { ProjectDataError } from '../project-data-error.js';

export const DEFAULT_PROJECT_SETTINGS: ProjectSettingsDocument = {
  version: 6,
  screenplayImport: {
    createContinuitySubjects: true,
    generateContinuityImages: false,
    runScreenplayAnalysis: false,
    generateSceneBeats: false,
    generateBeatStoryboardImages: false,
  },
  generation: {
    displayPreview: true,
    enableProviderPromptExpansion: true,
    image: {
      provider: 'codex',
      askBeforeGenerating: false,
      runGenerationsConcurrently: true,
      maxConcurrentGenerations: 5,
    },
    video: {
      provider: 'fal-ai',
      askBeforeGenerating: true,
      runGenerationsConcurrently: false,
      maxConcurrentGenerations: 1,
    },
    audio: {
      provider: 'elevenlabs',
      askBeforeGenerating: true,
      runGenerationsConcurrently: false,
      maxConcurrentGenerations: 1,
    },
  },
};

const concurrencySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'provider',
    'askBeforeGenerating',
    'runGenerationsConcurrently',
    'maxConcurrentGenerations',
  ],
  properties: {
    provider: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    askBeforeGenerating: { type: 'boolean' },
    runGenerationsConcurrently: { type: 'boolean' },
    maxConcurrentGenerations: { type: 'integer', minimum: 1, maximum: 5 },
  },
} as const;

const projectSettingsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'screenplayImport', 'generation'],
  properties: {
    version: { const: 6 },
    screenplayImport: {
      type: 'object',
      additionalProperties: false,
      required: [
        'createContinuitySubjects',
        'generateContinuityImages',
        'runScreenplayAnalysis',
        'generateSceneBeats',
        'generateBeatStoryboardImages',
      ],
      properties: {
        createContinuitySubjects: { type: 'boolean' },
        generateContinuityImages: { type: 'boolean' },
        runScreenplayAnalysis: { type: 'boolean' },
        generateSceneBeats: { type: 'boolean' },
        generateBeatStoryboardImages: { type: 'boolean' },
      },
    },
    generation: {
      type: 'object',
      additionalProperties: false,
      required: [
        'displayPreview',
        'enableProviderPromptExpansion',
        'image',
        'video',
        'audio',
      ],
      properties: {
        displayPreview: { type: 'boolean' },
        enableProviderPromptExpansion: { type: 'boolean' },
        image: concurrencySchema,
        video: concurrencySchema,
        audio: concurrencySchema,
      },
    },
  },
} as const;

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});
const validateProjectSettings = ajv.compile(projectSettingsSchema);

export function parseStoredProjectSettings(contents: string): ProjectSettingsDocument {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw invalidProjectSettings([
      createDiagnosticError(
        'PROJECT_SETTINGS002',
        'Stored Project Settings must be valid JSON.',
        { path: ['projectSettings'] },
        'Repair the selected Project through the supported migration or settings workflow.'
      ),
    ]);
  }
  return validateProjectSettingsDocument(value, ['projectSettings']);
}

export function validateProjectSettingsDocument(
  value: unknown,
  basePath: string[] = []
): ProjectSettingsDocument {
  if (!validateProjectSettings(value)) {
    throw invalidProjectSettings(
      mapAjvErrors(validateProjectSettings.errors ?? [], basePath)
    );
  }
  return value as ProjectSettingsDocument;
}

export function serializeProjectSettings(value: ProjectSettingsDocument): string {
  validateProjectSettingsDocument(value);
  return JSON.stringify(value);
}

function invalidProjectSettings(issues: DiagnosticIssue[]): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_SETTINGS002',
    'Project Settings document is invalid.',
    {
      issues,
      suggestion:
        'Provide one complete current-version Project Settings document and fix every reported issue.',
    }
  );
}

function mapAjvErrors(errors: ErrorObject[], basePath: string[]): DiagnosticIssue[] {
  return errors.map((error) => {
    const path = [...basePath, ...pointerToPath(error.instancePath)];
    const issuePath =
      error.keyword === 'required'
        ? [...path, String(error.params.missingProperty)]
        : error.keyword === 'additionalProperties'
          ? [...path, String(error.params.additionalProperty)]
          : path;
    return createDiagnosticError(
      'PROJECT_SETTINGS002',
      projectSettingsIssueMessage(error),
      { path: issuePath, context: 'Project Settings' },
      'Use the complete current version 6 Project Settings contract.'
    );
  });
}

function projectSettingsIssueMessage(error: ErrorObject): string {
  if (error.keyword === 'required') {
    return `${String(error.params.missingProperty)} is required.`;
  }
  if (error.keyword === 'additionalProperties') {
    return `Unknown Project Settings field: ${String(error.params.additionalProperty)}.`;
  }
  if (error.keyword === 'const') {
    return 'Project Settings version must be 6.';
  }
  if (error.keyword === 'minimum' || error.keyword === 'maximum') {
    return 'Maximum concurrent generations must be an integer from 1 through 5.';
  }
  return `Invalid Project Settings value${error.message ? `: ${error.message}` : '.'}`;
}

function pointerToPath(pointer: string): string[] {
  if (!pointer) {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}
