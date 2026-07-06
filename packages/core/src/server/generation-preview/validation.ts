import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type GenerationPreviewRequest,
  type GenerationPreviewRequestReference,
  type StudioGenerationPreview,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

const PROVIDER_UPLOAD_URL_HOST_PARTS = [
  'fal.media',
  'fal-ai',
  'storage.googleapis.com',
  'cloudinary.com',
  'replicate.delivery',
];

const GENERATION_PREVIEW_TOP_LEVEL_KEYS = new Set([
  'kind',
  'previewId',
  'generationSpecId',
  'purpose',
  'project',
  'target',
  'title',
  'model',
  'promptSheetVisualStyleId',
  'promptSheetNotationModeId',
  'finalPrompt',
  'references',
  'configuration',
  'providerPreview',
  'estimate',
  'diagnostics',
]);

const STUDIO_GENERATION_PREVIEW_TOP_LEVEL_KEYS = new Set([
  ...GENERATION_PREVIEW_TOP_LEVEL_KEYS,
  'subject',
]);

const GENERATION_PREVIEW_REQUEST_REFERENCE_KEYS = new Set([
  'kind',
  'role',
  'label',
  'providerToken',
  'assetId',
  'assetFileId',
  'sourcePurpose',
  'dialogueId',
  'selected',
  'selectionControl',
]);

const STUDIO_GENERATION_PREVIEW_REFERENCE_KEYS = new Set([
  ...GENERATION_PREVIEW_REQUEST_REFERENCE_KEYS,
  'browserUrl',
]);

const GENERATION_PREVIEW_REFERENCE_SELECTION_CONTROL_KEYS = new Set([
  'dependencyId',
  'required',
  'defaultIncluded',
  'editable',
  'inclusionOverride',
]);

const GENERATION_PREVIEW_CONFIGURATION_KEYS = new Set(['sections']);

const GENERATION_PREVIEW_CONFIGURATION_SECTION_KEYS = new Set([
  'key',
  'label',
  'rows',
]);

const GENERATION_PREVIEW_CONFIGURATION_ROW_KEYS = new Set([
  'key',
  'label',
  'value',
  'valueLabel',
  'providerField',
  'schemaDefault',
  'schemaDefaultLabel',
  'allowedValues',
  'minimum',
  'maximum',
  'required',
  'source',
  'emphasis',
  'presentation',
]);

const GENERATION_PREVIEW_CONFIGURATION_VALUE_SOURCES = new Set([
  'spec',
  'context-default',
  'renku-fixed',
  'provider-default',
  'derived',
  'model-capability',
  'provider-route',
]);

const GENERATION_PREVIEW_CONFIGURATION_PRESENTATIONS = new Set([
  'static',
  'parameter-control',
]);

const SUPPORTED_GENERATION_PREVIEW_PURPOSES = new Set<string>([
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
]);

export function validateGenerationPreviewRequest(
  value: unknown
): GenerationPreviewRequest {
  return validateGenerationPreviewEnvelope(value, {
    context: 'Generation preview request',
    topLevelKeys: GENERATION_PREVIEW_TOP_LEVEL_KEYS,
    allowBrowserUrl: false,
    requireSubject: false,
  }) as GenerationPreviewRequest;
}

export function validateStudioGenerationPreview(
  value: unknown
): StudioGenerationPreview {
  return validateGenerationPreviewEnvelope(value, {
    context: 'Studio generation preview',
    topLevelKeys: STUDIO_GENERATION_PREVIEW_TOP_LEVEL_KEYS,
    allowBrowserUrl: true,
    requireSubject: true,
  }) as StudioGenerationPreview;
}

function validateGenerationPreviewEnvelope(
  value: unknown,
  options: {
    context: string;
    topLevelKeys: Set<string>;
    allowBrowserUrl: boolean;
    requireSubject: boolean;
  }
): GenerationPreviewRequest | StudioGenerationPreview {
  const issues: DiagnosticIssue[] = [];
  const preview = readRecord(value);
  if (!preview) {
    throwPreviewError([
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_OBJECT_REQUIRED',
        `${options.context} must be an object.`,
        { path: [], context: options.context }
      ),
    ]);
  }

  validateTopLevelKeys(preview, options.topLevelKeys, options.context, issues);
  requireString(preview, 'kind', 'generationPreview', options.context, issues);
  requireNonEmptyString(preview, 'previewId', ['previewId'], options.context, issues);
  if (!SUPPORTED_GENERATION_PREVIEW_PURPOSES.has(String(preview.purpose))) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
        `Generation preview purpose must be one of: ${[
          ...SUPPORTED_GENERATION_PREVIEW_PURPOSES,
        ].join(', ')}.`,
        { path: ['purpose'], context: options.context }
      )
    );
  }
  if (
    preview.generationSpecId !== undefined &&
    (typeof preview.generationSpecId !== 'string' || !preview.generationSpecId.trim())
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_SPEC_ID_INVALID',
        'Generation preview generationSpecId must be a non-empty string when provided.',
        { path: ['generationSpecId'], context: options.context }
      )
    );
  }

  validateProject(preview.project, options.context, issues);
  validateTarget(preview.target, preview.purpose, options.context, issues);
  requireNonEmptyString(preview, 'title', ['title'], options.context, issues);
  validateModel(preview.model, options.context, issues);
  validatePrompt(preview.finalPrompt, options.context, issues);
  validateReferences(preview.references, preview.purpose, options, issues);
  validateConfiguration(preview.configuration, options.context, issues);
  validateProviderPreview(preview.providerPreview, options.context, issues);
  validateSubject(preview.subject, options, issues);
  if (!Array.isArray(preview.diagnostics)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_DIAGNOSTICS_INVALID',
        'Generation preview diagnostics must be an array.',
        { path: ['diagnostics'], context: options.context }
      )
    );
  }

  if (preview.purpose === SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE) {
    validatePromptSheetMetadata(preview, options.context, issues);
  } else {
    validatePromptSheetMetadataAbsent(preview, options.context, issues);
  }

  if (issues.length > 0) {
    throwPreviewError(issues);
  }
  return preview as unknown as GenerationPreviewRequest | StudioGenerationPreview;
}

function validateTopLevelKeys(
  preview: Record<string, unknown>,
  supportedKeys: Set<string>,
  context: string,
  issues: DiagnosticIssue[]
): void {
  for (const key of Object.keys(preview)) {
    if (!supportedKeys.has(key)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_FIELD_UNSUPPORTED',
          `Generation preview field is not supported: ${key}.`,
          { path: [key], context },
          'Send only the current generation preview envelope fields.'
        )
      );
    }
  }
}

function validateObjectKeys(
  record: Record<string, unknown>,
  supportedKeys: Set<string>,
  path: string[],
  context: string,
  issues: DiagnosticIssue[],
  code: string
): void {
  for (const key of Object.keys(record)) {
    if (!supportedKeys.has(key)) {
      issues.push(
        createDiagnosticError(
          code,
          `Generation preview configuration field is not supported: ${key}.`,
          { path: [...path, key], context },
          'Send only the current generation preview configuration contract fields.'
        )
      );
    }
  }
}

function validatePromptSheetMetadata(
  preview: Record<string, unknown>,
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (!isVideoPromptSheetVisualStyleId(preview.promptSheetVisualStyleId)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_VISUAL_STYLE_INVALID',
        'Generation preview promptSheetVisualStyleId must be cinematic-realistic or handdrawn-storyboard.',
        { path: ['promptSheetVisualStyleId'], context }
      )
    );
  }
  if (!isVideoPromptSheetNotationModeId(preview.promptSheetNotationModeId)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_NOTATION_MODE_INVALID',
        'Generation preview promptSheetNotationModeId must be none or motion-annotation.',
        { path: ['promptSheetNotationModeId'], context }
      )
    );
  }
}

function validatePromptSheetMetadataAbsent(
  preview: Record<string, unknown>,
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (preview.promptSheetVisualStyleId !== undefined) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_VISUAL_STYLE_FORBIDDEN',
        'Generation preview promptSheetVisualStyleId is only valid for shot.video-prompt-sheet previews.',
        { path: ['promptSheetVisualStyleId'], context }
      )
    );
  }
  if (preview.promptSheetNotationModeId !== undefined) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_NOTATION_MODE_FORBIDDEN',
        'Generation preview promptSheetNotationModeId is only valid for shot.video-prompt-sheet previews.',
        { path: ['promptSheetNotationModeId'], context }
      )
    );
  }
}

function validateProject(
  value: unknown,
  context: string,
  issues: DiagnosticIssue[]
): void {
  const project = readRecord(value);
  if (!project) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROJECT_REQUIRED',
        'Generation preview project must be an object.',
        { path: ['project'], context }
      )
    );
    return;
  }
  requireNonEmptyString(project, 'id', ['project', 'id'], context, issues);
  requireNonEmptyString(project, 'name', ['project', 'name'], context, issues);
  if (project.title !== undefined && typeof project.title !== 'string') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROJECT_TITLE_INVALID',
        'Generation preview project.title must be a string.',
        { path: ['project', 'title'], context }
      )
    );
  }
}

function validateTarget(
  value: unknown,
  purpose: unknown,
  context: string,
  issues: DiagnosticIssue[]
): void {
  const target = readRecord(value);
  if (!target) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_REQUIRED',
        'Generation preview target must be an object.',
        { path: ['target'], context }
      )
    );
    return;
  }
  if (purpose === CAST_CHARACTER_SHEET_GENERATION_PURPOSE) {
    validateCastMemberTarget(target, context, issues);
    return;
  }
  if (purpose === CAST_PROFILE_GENERATION_PURPOSE) {
    validateCastMemberTarget(target, context, issues);
    return;
  }
  if (
    purpose === LOOKBOOK_IMAGE_GENERATION_PURPOSE ||
    purpose === LOOKBOOK_SHEET_GENERATION_PURPOSE
  ) {
    validateSimpleIdTarget(target, 'lookbook', context, issues);
    return;
  }
  if (
    purpose === LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE ||
    purpose === LOCATION_HERO_GENERATION_PURPOSE
  ) {
    validateSimpleIdTarget(target, 'location', context, issues);
    return;
  }
  if (purpose === SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE) {
    validateSimpleIdTarget(target, 'scene', context, issues);
    return;
  }
  validateSceneShotVideoTakeTarget(target, context, issues);
}

function validateSimpleIdTarget(
  target: Record<string, unknown>,
  kind: 'lookbook' | 'location' | 'scene',
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (target.kind !== kind) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_UNSUPPORTED',
        `Generation preview target must be a ${kind} target.`,
        { path: ['target', 'kind'], context }
      )
    );
  }
  requireNonEmptyString(target, 'id', ['target', 'id'], context, issues);
}

function validateSceneShotVideoTakeTarget(
  target: Record<string, unknown>,
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (target.kind !== 'sceneShotVideoTake') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_UNSUPPORTED',
        'Generation preview target must be a sceneShotVideoTake target.',
        { path: ['target', 'kind'], context }
      )
    );
  }
  requireNonEmptyString(target, 'sceneId', ['target', 'sceneId'], context, issues);
  requireNonEmptyString(target, 'takeId', ['target', 'takeId'], context, issues);
  if (
    !Array.isArray(target.shotIds) ||
    target.shotIds.length === 0 ||
    target.shotIds.some((shotId) => typeof shotId !== 'string' || !shotId.trim())
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_SHOTS_INVALID',
        'Generation preview target.shotIds must be non-empty strings.',
        { path: ['target', 'shotIds'], context }
      )
    );
  }
}

function validateCastMemberTarget(
  target: Record<string, unknown>,
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (target.kind !== 'castMember') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_UNSUPPORTED',
        'Generation preview target must be a castMember target for cast.character-sheet previews.',
        { path: ['target', 'kind'], context }
      )
    );
  }
  requireNonEmptyString(target, 'id', ['target', 'id'], context, issues);
}

function validateModel(
  value: unknown,
  context: string,
  issues: DiagnosticIssue[]
): void {
  const model = readRecord(value);
  if (!model) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_MODEL_REQUIRED',
        'Generation preview model must be an object.',
        { path: ['model'], context }
      )
    );
    return;
  }
  requireNonEmptyString(model, 'provider', ['model', 'provider'], context, issues);
  requireNonEmptyString(model, 'modelId', ['model', 'modelId'], context, issues);
  if (model.mediaKind !== 'image' && model.mediaKind !== 'video') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_MODEL_MEDIA_KIND_INVALID',
        'Generation preview model.mediaKind must be image or video.',
        { path: ['model', 'mediaKind'], context }
      )
    );
  }
}

function validatePrompt(
  value: unknown,
  context: string,
  issues: DiagnosticIssue[]
): void {
  const prompt = readRecord(value);
  if (!prompt) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_REQUIRED',
        'Generation preview finalPrompt must be an object.',
        { path: ['finalPrompt'], context }
      )
    );
    return;
  }
  requireNonEmptyString(prompt, 'text', ['finalPrompt', 'text'], context, issues);
}

function validateReferences(
  value: unknown,
  purpose: unknown,
  options: {
    context: string;
    allowBrowserUrl: boolean;
  },
  issues: DiagnosticIssue[]
): void {
  if (!Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCES_INVALID',
        'Generation preview references must be an array.',
        { path: ['references'], context: options.context }
      )
    );
    return;
  }
  value.forEach((reference, index) => {
    validateReference(reference, index, purpose, options, issues);
  });
}

function validateReference(
  value: unknown,
  index: number,
  purpose: unknown,
  options: {
    context: string;
    allowBrowserUrl: boolean;
  },
  issues: DiagnosticIssue[]
): void {
  const reference = readRecord(value) as GenerationPreviewRequestReference | null;
  const path = ['references', String(index)];
  if (!reference) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_INVALID',
        'Generation preview reference must be an object.',
        { path, context: options.context }
      )
    );
    return;
  }
  const supportedKeys = options.allowBrowserUrl
    ? STUDIO_GENERATION_PREVIEW_REFERENCE_KEYS
    : GENERATION_PREVIEW_REQUEST_REFERENCE_KEYS;
  for (const key of Object.keys(reference)) {
    if (!supportedKeys.has(key)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_FIELD_UNSUPPORTED',
          `Generation preview reference field is not supported: ${key}.`,
          { path: [...path, key], context: options.context },
          options.allowBrowserUrl
            ? 'Send only the current Studio display reference fields.'
            : 'Send logical project references only. Studio resolves browser URLs server-side.'
        )
      );
    }
  }
  if (
    reference.kind !== 'image' &&
    reference.kind !== 'audio' &&
    reference.kind !== 'video'
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_KIND_INVALID',
        'Generation preview reference kind must be image, audio, or video.',
        { path: [...path, 'kind'], context: options.context }
      )
    );
  }
  if (
    purpose === CAST_CHARACTER_SHEET_GENERATION_PURPOSE &&
    reference.kind !== undefined &&
    reference.kind !== 'image'
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_KIND_UNSUPPORTED',
        'Cast character sheet generation preview references must be image references.',
        { path: [...path, 'kind'], context: options.context },
        'Use image reference assets for character sheet previews.'
      )
    );
  }
  for (const key of ['role', 'label', 'assetId', 'assetFileId'] as const) {
    if (typeof reference[key] !== 'string' || !reference[key].trim()) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_FIELD_REQUIRED',
          `Generation preview reference.${key} must be a non-empty string.`,
          { path: [...path, key], context: options.context }
        )
      );
    }
  }
  if (options.allowBrowserUrl) {
    if (
      typeof (reference as { browserUrl?: unknown }).browserUrl !== 'string' ||
      !(reference as { browserUrl?: string }).browserUrl?.trim()
    ) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_BROWSER_URL_REQUIRED',
          'Studio generation preview reference.browserUrl must be a non-empty string.',
          { path: [...path, 'browserUrl'], context: options.context }
        )
      );
    }
  }
  if (typeof reference.selected !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_SELECTED_INVALID',
        'Generation preview reference.selected must be a boolean.',
        { path: [...path, 'selected'], context: options.context }
      )
    );
  }
  validateSelectionControl(
    (reference as { selectionControl?: unknown }).selectionControl,
    path,
    options.context,
    issues
  );
  for (const [key, candidate] of Object.entries(reference)) {
    if (key === 'browserUrl' && options.allowBrowserUrl) {
      validateStudioBrowserUrl(candidate, [...path, key], options.context, issues);
      continue;
    }
    if (typeof candidate === 'string' && leaksLocalOrProviderPath(candidate)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_PATH_FORBIDDEN',
          'Generation preview references must not include local paths or provider upload URLs.',
          { path: [...path, key], context: options.context },
          'Send logical project references such as assetId and assetFileId instead.'
        )
      );
    }
  }
}

function validateSelectionControl(
  value: unknown,
  referencePath: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (value === undefined) {
    return;
  }
  const control = readRecord(value);
  if (!control) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_SELECTION_CONTROL_INVALID',
        'Generation preview reference.selectionControl must be an object.',
        { path: [...referencePath, 'selectionControl'], context }
      )
    );
    return;
  }
  const path = [...referencePath, 'selectionControl'];
  for (const [key, candidate] of Object.entries(control)) {
    if (!GENERATION_PREVIEW_REFERENCE_SELECTION_CONTROL_KEYS.has(key)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_SELECTION_CONTROL_FIELD_UNSUPPORTED',
          `Generation preview reference.selectionControl field is not supported: ${key}.`,
          { path: [...path, key], context },
          'Send only dependencyId, required, defaultIncluded, editable, and inclusionOverride.'
        )
      );
    }
    if (typeof candidate === 'string' && leaksLocalOrProviderPath(candidate)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_PATH_FORBIDDEN',
          'Generation preview references must not include local paths or provider upload URLs.',
          { path: [...path, key], context },
          'Send logical project references such as assetId and assetFileId instead.'
        )
      );
    }
  }
  requireNonEmptyString(control, 'dependencyId', [...path, 'dependencyId'], context, issues);
  for (const key of ['required', 'defaultIncluded', 'editable'] as const) {
    if (typeof control[key] !== 'boolean') {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_SELECTION_CONTROL_FIELD_INVALID',
          `Generation preview reference.selectionControl.${key} must be a boolean.`,
          { path: [...path, key], context }
        )
      );
    }
  }
  if (
    control.inclusionOverride !== null &&
    control.inclusionOverride !== 'include' &&
    control.inclusionOverride !== 'exclude'
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_SELECTION_CONTROL_OVERRIDE_INVALID',
        'Generation preview reference.selectionControl.inclusionOverride must be include, exclude, or null.',
        { path: [...path, 'inclusionOverride'], context }
      )
    );
  }
}

function validateStudioBrowserUrl(
  value: unknown,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (typeof value !== 'string') {
    return;
  }
  if (!value.startsWith('/studio-api/projects/')) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_BROWSER_URL_INVALID',
        'Studio generation preview reference.browserUrl must be a Studio asset-file route.',
        { path, context },
        'Resolve preview media through the Studio server asset-file route.'
      )
    );
  }
}

function validateConfiguration(
  value: unknown,
  context: string,
  issues: DiagnosticIssue[]
): void {
  const configuration = readRecord(value);
  if (!configuration) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_INVALID',
        'Generation preview configuration must be an object.',
        { path: ['configuration'], context }
      )
    );
    return;
  }
  validateObjectKeys(
    configuration,
    GENERATION_PREVIEW_CONFIGURATION_KEYS,
    ['configuration'],
    context,
    issues,
    'CORE_GENERATION_PREVIEW_CONFIGURATION_FIELD_UNSUPPORTED'
  );
  if (!Array.isArray(configuration.sections)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_SECTIONS_INVALID',
        'Generation preview configuration.sections must be an array.',
        { path: ['configuration', 'sections'], context }
      )
    );
    return;
  }
  configuration.sections.forEach((section, sectionIndex) => {
    validateConfigurationSection(section, sectionIndex, context, issues);
  });
}

function validateConfigurationSection(
  value: unknown,
  sectionIndex: number,
  context: string,
  issues: DiagnosticIssue[]
): void {
  const path = ['configuration', 'sections', String(sectionIndex)];
  const section = readRecord(value);
  if (!section) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_SECTION_INVALID',
        'Generation preview configuration section must be an object.',
        { path, context }
      )
    );
    return;
  }
  validateObjectKeys(
    section,
    GENERATION_PREVIEW_CONFIGURATION_SECTION_KEYS,
    path,
    context,
    issues,
    'CORE_GENERATION_PREVIEW_CONFIGURATION_SECTION_FIELD_UNSUPPORTED'
  );
  requireNonEmptyString(section, 'key', [...path, 'key'], context, issues);
  requireNonEmptyString(section, 'label', [...path, 'label'], context, issues);
  if (!Array.isArray(section.rows)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_ROWS_INVALID',
        'Generation preview configuration section.rows must be an array.',
        { path: [...path, 'rows'], context }
      )
    );
    return;
  }
  section.rows.forEach((row, rowIndex) =>
    validateConfigurationRow(row, [...path, 'rows', String(rowIndex)], context, issues)
  );
}

function validateConfigurationRow(
  value: unknown,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  const row = readRecord(value);
  if (!row) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_ROW_INVALID',
        'Generation preview configuration row must be an object.',
        { path, context }
      )
    );
    return;
  }
  validateObjectKeys(
    row,
    GENERATION_PREVIEW_CONFIGURATION_ROW_KEYS,
    path,
    context,
    issues,
    'CORE_GENERATION_PREVIEW_CONFIGURATION_ROW_FIELD_UNSUPPORTED'
  );
  requireNonEmptyString(row, 'key', [...path, 'key'], context, issues);
  requireNonEmptyString(row, 'label', [...path, 'label'], context, issues);
  validateConfigurationValue(row.value, [...path, 'value'], context, issues);
  if (!GENERATION_PREVIEW_CONFIGURATION_VALUE_SOURCES.has(String(row.source))) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_SOURCE_INVALID',
        'Generation preview configuration row.source is not supported.',
        { path: [...path, 'source'], context },
        'Use one of spec, context-default, renku-fixed, provider-default, derived, model-capability, or provider-route.'
      )
    );
  }
  if (
    row.presentation !== undefined &&
    !GENERATION_PREVIEW_CONFIGURATION_PRESENTATIONS.has(String(row.presentation))
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_PRESENTATION_INVALID',
        'Generation preview configuration row.presentation is not supported.',
        { path: [...path, 'presentation'], context },
        'Use static or parameter-control.'
      )
    );
  }
  if (
    row.emphasis !== undefined &&
    row.emphasis !== 'primary' &&
    row.emphasis !== 'secondary'
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_EMPHASIS_INVALID',
        'Generation preview configuration row.emphasis must be primary or secondary.',
        { path: [...path, 'emphasis'], context }
      )
    );
  }
  for (const key of ['valueLabel', 'providerField', 'schemaDefaultLabel'] as const) {
    if (row[key] !== undefined && typeof row[key] !== 'string') {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_CONFIGURATION_ROW_STRING_INVALID',
          `Generation preview configuration row.${key} must be a string when provided.`,
          { path: [...path, key], context }
        )
      );
    }
  }
  if (row.schemaDefault !== undefined) {
    validateConfigurationValue(row.schemaDefault, [...path, 'schemaDefault'], context, issues);
  }
  if (row.allowedValues !== undefined) {
    if (!Array.isArray(row.allowedValues)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_CONFIGURATION_ALLOWED_VALUES_INVALID',
          'Generation preview configuration row.allowedValues must be an array when provided.',
          { path: [...path, 'allowedValues'], context }
        )
      );
    } else {
      row.allowedValues.forEach((item, index) =>
        validateConfigurationValue(
          item,
          [...path, 'allowedValues', String(index)],
          context,
          issues
        )
      );
    }
  }
  for (const key of ['minimum', 'maximum'] as const) {
    if (row[key] !== undefined && typeof row[key] !== 'number') {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_CONFIGURATION_BOUND_INVALID',
          `Generation preview configuration row.${key} must be a number when provided.`,
          { path: [...path, key], context }
        )
      );
    }
  }
  if (row.required !== undefined && typeof row.required !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_REQUIRED_INVALID',
        'Generation preview configuration row.required must be a boolean when provided.',
        { path: [...path, 'required'], context }
      )
    );
  }
  if (row.presentation === 'parameter-control') {
    validateParameterControlRow(row, path, context, issues);
  }
}

function validateParameterControlRow(
  row: Record<string, unknown>,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  const value = row.value;
  if (isDimensionsConfigurationValue(value) || Array.isArray(value)) {
    return;
  }
  if (
    typeof value === 'string' &&
    !Array.isArray(row.allowedValues) &&
    row.schemaDefault === undefined
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_PARAMETER_METADATA_REQUIRED',
        'Text parameter-control rows must include allowedValues or schemaDefault.',
        { path, context },
        'Send enough schema metadata for Studio to render the read-only control without provider-specific branching.'
      )
    );
  }
}

function validateConfigurationValue(
  value: unknown,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return;
  }
  if (Array.isArray(value)) {
    if (
      value.every(
        (item) =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'
      )
    ) {
      return;
    }
  } else if (isDimensionsConfigurationValue(value)) {
    return;
  }
  issues.push(
    createDiagnosticError(
      'CORE_GENERATION_PREVIEW_CONFIGURATION_VALUE_INVALID',
      'Generation preview configuration values must be scalar, null, scalar arrays, or dimensions objects.',
      { path, context }
    )
  );
}

function isDimensionsConfigurationValue(value: unknown): boolean {
  const dimensions = readRecord(value);
  return Boolean(
    dimensions &&
      dimensions.kind === 'dimensions' &&
      typeof dimensions.width === 'number' &&
      typeof dimensions.height === 'number'
  );
}

function validateProviderPreview(
  value: unknown,
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (value === undefined) {
    return;
  }
  const preview = readRecord(value);
  if (!preview) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROVIDER_PREVIEW_INVALID',
        'Generation preview providerPreview must be an object.',
        { path: ['providerPreview'], context }
      )
    );
    return;
  }
  if (preview.provider !== undefined) {
    requireNonEmptyString(preview, 'provider', ['providerPreview', 'provider'], context, issues);
  }
  if (preview.model !== undefined) {
    requireNonEmptyString(preview, 'model', ['providerPreview', 'model'], context, issues);
  }
  if (preview.payload !== undefined) {
    if (!readRecord(preview.payload)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_PROVIDER_PAYLOAD_INVALID',
          'Generation preview providerPreview.payload must be an object.',
          { path: ['providerPreview', 'payload'], context }
        )
      );
      return;
    }
    validateNoLeakedPath(preview.payload, ['providerPreview', 'payload'], context, issues);
  }
}

function validateSubject(
  value: unknown,
  options: {
    context: string;
    requireSubject: boolean;
  },
  issues: DiagnosticIssue[]
): void {
  if (!options.requireSubject) {
    if (value !== undefined) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_SUBJECT_FORBIDDEN',
          'Generation preview request must not include Studio display subject labels.',
          { path: ['subject'], context: options.context },
          'Studio resolves subject labels server-side before publishing the event.'
        )
      );
    }
    return;
  }
  const subject = readRecord(value);
  if (!subject) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_SUBJECT_REQUIRED',
        'Studio generation preview subject must be an object.',
        { path: ['subject'], context: options.context }
      )
    );
    return;
  }
  requireNonEmptyString(
    subject,
    'projectLabel',
    ['subject', 'projectLabel'],
    options.context,
    issues
  );
  for (const key of ['sceneLabel', 'takeLabel', 'shotLabel', 'castMemberLabel'] as const) {
    if (subject[key] !== undefined && typeof subject[key] !== 'string') {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_SUBJECT_LABEL_INVALID',
          `Studio generation preview subject.${key} must be a string when provided.`,
          { path: ['subject', key], context: options.context }
        )
      );
    }
  }
}

function validateNoLeakedPath(
  value: unknown,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (typeof value === 'string') {
    if (leaksLocalOrProviderPath(value)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_PROVIDER_PAYLOAD_PATH_FORBIDDEN',
          'Generation preview provider payload must not include local paths or provider upload URLs.',
          { path, context },
          'Show logical references and sanitized provider payloads only.'
        )
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateNoLeakedPath(item, [...path, String(index)], context, issues)
    );
    return;
  }
  const record = readRecord(value);
  if (!record) {
    return;
  }
  for (const [key, nested] of Object.entries(record)) {
    validateNoLeakedPath(nested, [...path, key], context, issues);
  }
}

function isVideoPromptSheetVisualStyleId(value: unknown): boolean {
  return value === 'cinematic-realistic' || value === 'handdrawn-storyboard';
}

function isVideoPromptSheetNotationModeId(value: unknown): boolean {
  return value === 'none' || value === 'motion-annotation';
}

function leaksLocalOrProviderPath(value: string): boolean {
  if (
    value.startsWith('/') ||
    value.startsWith('file://') ||
    /^[A-Za-z]:[\\/]/.test(value)
  ) {
    return true;
  }
  try {
    const url = new URL(value);
    return PROVIDER_UPLOAD_URL_HOST_PARTS.some((part) =>
      url.hostname.includes(part)
    );
  } catch {
    return false;
  }
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  expected: string,
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (record[key] !== expected) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_FIELD_INVALID',
        `Generation preview ${key} must be ${expected}.`,
        { path: [key], context }
      )
    );
  }
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): void {
  if (typeof record[key] !== 'string' || !record[key].trim()) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_FIELD_REQUIRED',
        `${path.join('.')} must be a non-empty string.`,
        { path, context }
      )
    );
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function throwPreviewError(issues: DiagnosticIssue[]): never {
  throw new ProjectDataError(
    'CORE_GENERATION_PREVIEW_INVALID',
    'Generation preview snapshot failed validation.',
    {
      issues,
      suggestion:
        'Send a complete generationPreview snapshot with logical references and valid target/model/prompt data.',
    }
  );
}
