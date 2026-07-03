import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type GenerationPreviewReference,
  type GenerationPreviewSnapshot,
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

export function validateGenerationPreviewSnapshot(
  value: unknown
): GenerationPreviewSnapshot {
  const issues: DiagnosticIssue[] = [];
  const preview = readRecord(value);
  if (!preview) {
    throwPreviewError([
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_OBJECT_REQUIRED',
        'Generation preview snapshot must be an object.',
        { path: [], context: 'Generation preview snapshot' }
      ),
    ]);
  }

  validateTopLevelKeys(preview, issues);
  requireString(preview, 'kind', 'generationPreview', issues);
  requireNonEmptyString(preview, 'previewId', ['previewId'], issues);
  if (
    preview.purpose !== SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE &&
    preview.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
        'Generation preview purpose must be shot.video-prompt-sheet or shot.video-take.',
        { path: ['purpose'], context: 'Generation preview snapshot' }
      )
    );
  }

  validateProject(preview.project, issues);
  validateTarget(preview.target, issues);
  requireNonEmptyString(preview, 'title', ['title'], issues);
  validateModel(preview.model, issues);
  validatePrompt(preview.finalPrompt, issues);
  validateReferences(preview.references, issues);
  validateConfiguration(preview.configuration, issues);
  validateProviderPreview(preview.providerPreview, issues);
  if (!Array.isArray(preview.diagnostics)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_DIAGNOSTICS_INVALID',
        'Generation preview diagnostics must be an array.',
        { path: ['diagnostics'], context: 'Generation preview snapshot' }
      )
    );
  }

  if (preview.purpose === SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE) {
    validatePromptSheetMetadata(preview, issues);
  } else {
    validatePromptSheetMetadataAbsent(preview, issues);
  }

  if (issues.length > 0) {
    throwPreviewError(issues);
  }
  return preview as unknown as GenerationPreviewSnapshot;
}

function validateTopLevelKeys(
  preview: Record<string, unknown>,
  issues: DiagnosticIssue[]
): void {
  for (const key of Object.keys(preview)) {
    if (!GENERATION_PREVIEW_TOP_LEVEL_KEYS.has(key)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_FIELD_UNSUPPORTED',
          `Generation preview field is not supported: ${key}.`,
          { path: [key], context: 'Generation preview snapshot' },
          'Send only the current generation preview envelope fields.'
        )
      );
    }
  }
}

function validatePromptSheetMetadata(
  preview: Record<string, unknown>,
  issues: DiagnosticIssue[]
): void {
  if (!isVideoPromptSheetVisualStyleId(preview.promptSheetVisualStyleId)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_VISUAL_STYLE_INVALID',
        'Generation preview promptSheetVisualStyleId must be cinematic-realistic or handdrawn-storyboard.',
        { path: ['promptSheetVisualStyleId'], context: 'Generation preview snapshot' }
      )
    );
  }
  if (!isVideoPromptSheetNotationModeId(preview.promptSheetNotationModeId)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_NOTATION_MODE_INVALID',
        'Generation preview promptSheetNotationModeId must be none or motion-annotation.',
        { path: ['promptSheetNotationModeId'], context: 'Generation preview snapshot' }
      )
    );
  }
}

function validatePromptSheetMetadataAbsent(
  preview: Record<string, unknown>,
  issues: DiagnosticIssue[]
): void {
  if (preview.promptSheetVisualStyleId !== undefined) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_VISUAL_STYLE_FORBIDDEN',
        'Generation preview promptSheetVisualStyleId is only valid for shot.video-prompt-sheet previews.',
        { path: ['promptSheetVisualStyleId'], context: 'Generation preview snapshot' }
      )
    );
  }
  if (preview.promptSheetNotationModeId !== undefined) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_SHEET_NOTATION_MODE_FORBIDDEN',
        'Generation preview promptSheetNotationModeId is only valid for shot.video-prompt-sheet previews.',
        { path: ['promptSheetNotationModeId'], context: 'Generation preview snapshot' }
      )
    );
  }
}

function validateProject(value: unknown, issues: DiagnosticIssue[]): void {
  const project = readRecord(value);
  if (!project) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROJECT_REQUIRED',
        'Generation preview project must be an object.',
        { path: ['project'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  requireNonEmptyString(project, 'id', ['project', 'id'], issues);
  requireNonEmptyString(project, 'name', ['project', 'name'], issues);
  if (project.title !== undefined && typeof project.title !== 'string') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROJECT_TITLE_INVALID',
        'Generation preview project.title must be a string.',
        { path: ['project', 'title'], context: 'Generation preview snapshot' }
      )
    );
  }
}

function validateTarget(value: unknown, issues: DiagnosticIssue[]): void {
  const target = readRecord(value);
  if (!target) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_REQUIRED',
        'Generation preview target must be an object.',
        { path: ['target'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  if (target.kind !== 'sceneShotVideoTake') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_UNSUPPORTED',
        'Generation preview target must be a sceneShotVideoTake target.',
        { path: ['target', 'kind'], context: 'Generation preview snapshot' }
      )
    );
  }
  requireNonEmptyString(target, 'sceneId', ['target', 'sceneId'], issues);
  requireNonEmptyString(target, 'takeId', ['target', 'takeId'], issues);
  if (
    !Array.isArray(target.shotIds) ||
    target.shotIds.length === 0 ||
    target.shotIds.some((shotId) => typeof shotId !== 'string' || !shotId.trim())
  ) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_TARGET_SHOTS_INVALID',
        'Generation preview target.shotIds must be non-empty strings.',
        { path: ['target', 'shotIds'], context: 'Generation preview snapshot' }
      )
    );
  }
}

function validateModel(value: unknown, issues: DiagnosticIssue[]): void {
  const model = readRecord(value);
  if (!model) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_MODEL_REQUIRED',
        'Generation preview model must be an object.',
        { path: ['model'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  requireNonEmptyString(model, 'provider', ['model', 'provider'], issues);
  requireNonEmptyString(model, 'modelId', ['model', 'modelId'], issues);
  if (model.mediaKind !== 'image' && model.mediaKind !== 'video') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_MODEL_MEDIA_KIND_INVALID',
        'Generation preview model.mediaKind must be image or video.',
        { path: ['model', 'mediaKind'], context: 'Generation preview snapshot' }
      )
    );
  }
}

function validatePrompt(value: unknown, issues: DiagnosticIssue[]): void {
  const prompt = readRecord(value);
  if (!prompt) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROMPT_REQUIRED',
        'Generation preview finalPrompt must be an object.',
        { path: ['finalPrompt'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  requireNonEmptyString(prompt, 'text', ['finalPrompt', 'text'], issues);
}

function validateReferences(value: unknown, issues: DiagnosticIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCES_INVALID',
        'Generation preview references must be an array.',
        { path: ['references'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  value.forEach((reference, index) => {
    validateReference(reference, index, issues);
  });
}

function validateReference(
  value: unknown,
  index: number,
  issues: DiagnosticIssue[]
): void {
  const reference = readRecord(value) as GenerationPreviewReference | null;
  const path = ['references', String(index)];
  if (!reference) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_INVALID',
        'Generation preview reference must be an object.',
        { path, context: 'Generation preview snapshot' }
      )
    );
    return;
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
        { path: [...path, 'kind'], context: 'Generation preview snapshot' }
      )
    );
  }
  for (const key of ['role', 'label', 'assetId', 'assetFileId'] as const) {
    if (typeof reference[key] !== 'string' || !reference[key].trim()) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_FIELD_REQUIRED',
          `Generation preview reference.${key} must be a non-empty string.`,
          { path: [...path, key], context: 'Generation preview snapshot' }
        )
      );
    }
  }
  if (typeof reference.selected !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_REFERENCE_SELECTED_INVALID',
        'Generation preview reference.selected must be a boolean.',
        { path: [...path, 'selected'], context: 'Generation preview snapshot' }
      )
    );
  }
  for (const [key, candidate] of Object.entries(reference)) {
    if (typeof candidate === 'string' && leaksLocalOrProviderPath(candidate)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_REFERENCE_PATH_FORBIDDEN',
          'Generation preview references must not include local paths or provider upload URLs.',
          { path: [...path, key], context: 'Generation preview snapshot' },
          'Send logical project references such as assetId and assetFileId instead.'
        )
      );
    }
  }
}

function validateConfiguration(value: unknown, issues: DiagnosticIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_CONFIGURATION_INVALID',
        'Generation preview configuration must be an array.',
        { path: ['configuration'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  value.forEach((item, index) => {
    const record = readRecord(item);
    if (!record) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_CONFIGURATION_ITEM_INVALID',
          'Generation preview configuration item must be an object.',
          { path: ['configuration', String(index)], context: 'Generation preview snapshot' }
        )
      );
      return;
    }
    requireNonEmptyString(record, 'key', ['configuration', String(index), 'key'], issues);
    requireNonEmptyString(record, 'label', ['configuration', String(index), 'label'], issues);
  });
}

function validateProviderPreview(value: unknown, issues: DiagnosticIssue[]): void {
  if (value === undefined) {
    return;
  }
  const preview = readRecord(value);
  if (!preview) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_PROVIDER_PREVIEW_INVALID',
        'Generation preview providerPreview must be an object.',
        { path: ['providerPreview'], context: 'Generation preview snapshot' }
      )
    );
    return;
  }
  if (preview.provider !== undefined) {
    requireNonEmptyString(preview, 'provider', ['providerPreview', 'provider'], issues);
  }
  if (preview.model !== undefined) {
    requireNonEmptyString(preview, 'model', ['providerPreview', 'model'], issues);
  }
  if (preview.payload !== undefined) {
    if (!readRecord(preview.payload)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_PROVIDER_PAYLOAD_INVALID',
          'Generation preview providerPreview.payload must be an object.',
          { path: ['providerPreview', 'payload'], context: 'Generation preview snapshot' }
        )
      );
      return;
    }
    validateNoLeakedPath(preview.payload, ['providerPreview', 'payload'], issues);
  }
}

function validateNoLeakedPath(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): void {
  if (typeof value === 'string') {
    if (leaksLocalOrProviderPath(value)) {
      issues.push(
        createDiagnosticError(
          'CORE_GENERATION_PREVIEW_PROVIDER_PAYLOAD_PATH_FORBIDDEN',
          'Generation preview provider payload must not include local paths or provider upload URLs.',
          { path, context: 'Generation preview snapshot' },
          'Show logical references and sanitized provider payloads only.'
        )
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateNoLeakedPath(item, [...path, String(index)], issues)
    );
    return;
  }
  const record = readRecord(value);
  if (!record) {
    return;
  }
  for (const [key, nested] of Object.entries(record)) {
    validateNoLeakedPath(nested, [...path, key], issues);
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
  issues: DiagnosticIssue[]
): void {
  if (record[key] !== expected) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_FIELD_INVALID',
        `Generation preview ${key} must be ${expected}.`,
        { path: [key], context: 'Generation preview snapshot' }
      )
    );
  }
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  path: string[],
  issues: DiagnosticIssue[]
): void {
  if (typeof record[key] !== 'string' || !record[key].trim()) {
    issues.push(
      createDiagnosticError(
        'CORE_GENERATION_PREVIEW_FIELD_REQUIRED',
        `${path.join('.')} must be a non-empty string.`,
        { path, context: 'Generation preview snapshot' }
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
