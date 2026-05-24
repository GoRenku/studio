import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  InspirationAnalysis,
  Lookbook,
  LookbookSection,
} from '../../client/index.js';
import {
  cameraSectionSchema,
  inspirationAnalysisDocumentSchema,
  inspirationAnalysisSectionsSchema,
  inspiredBySectionSchema,
  paletteSectionSchema,
  patternSectionSchema,
  textureSectionSchema,
  thesisSectionSchema,
  toneMoodSectionSchema,
} from '../../client/visual-language-json-schemas.js';

const schemaIds = {
  thesis: 'https://schemas.gorenku.com/studio/visual-language-thesis-section.schema.json',
  palette: 'https://schemas.gorenku.com/studio/visual-language-palette-section.schema.json',
  toneMood: 'https://schemas.gorenku.com/studio/visual-language-tone-mood-section.schema.json',
  composition: 'https://schemas.gorenku.com/studio/visual-language-pattern-section.schema.json',
  lighting: 'https://schemas.gorenku.com/studio/visual-language-pattern-section.schema.json',
  texture: 'https://schemas.gorenku.com/studio/visual-language-texture-section.schema.json',
  inspiredBy: 'https://schemas.gorenku.com/studio/visual-language-inspired-by-section.schema.json',
  camera: 'https://schemas.gorenku.com/studio/visual-language-camera-section.schema.json',
} as const;

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(thesisSectionSchema);
ajv.addSchema(paletteSectionSchema);
ajv.addSchema(toneMoodSectionSchema);
ajv.addSchema(patternSectionSchema);
ajv.addSchema(textureSectionSchema);
ajv.addSchema(inspiredBySectionSchema);
ajv.addSchema(cameraSectionSchema);
ajv.addSchema(inspirationAnalysisSectionsSchema);
ajv.addSchema(inspirationAnalysisDocumentSchema);

export type InspirationAnalysisSections = Omit<InspirationAnalysis, 'folderId'>;
export type LookbookSections = Omit<Lookbook, 'id' | 'name'>;
export type VisualLanguageStoredSectionKind = keyof typeof schemaIds;

export interface InspirationAnalysisDocument {
  kind: 'inspirationAnalysis';
  analysis: InspirationAnalysisSections;
}

export function parseVisualLanguageJson(input: {
  contents: string;
  filePath?: string;
}): unknown {
  try {
    const parsed = JSON.parse(input.contents);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throwInvalidJson(input.filePath);
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throwInvalidJson(input.filePath);
    }
    throw error;
  }
}

export function parseInspirationAnalysisDocument(input: {
  contents: string;
  filePath?: string;
}): InspirationAnalysisDocument {
  const parsed = parseVisualLanguageJson(input);
  validateInspirationAnalysisDocumentShape({
    document: parsed,
    filePath: input.filePath,
  });
  return parsed as InspirationAnalysisDocument;
}

export function serializeInspirationAnalysisSections(input: {
  sections: InspirationAnalysisSections;
  folderImageFiles: Set<string>;
  filePath?: string;
}): Record<keyof InspirationAnalysisSections, string> {
  validateInspirationAnalysisSections(input);
  return serializeSections(input.sections);
}

export function serializeInspirationAnalysisDocument(input: {
  document: InspirationAnalysisDocument;
  folderImageFiles: Set<string>;
  filePath?: string;
}): Record<keyof InspirationAnalysisSections, string> {
  validateInspirationAnalysisDocument(input);
  return serializeSections(input.document.analysis);
}

export function serializeLookbookSections(input: {
  sections: LookbookSections;
  filePath?: string;
}): Record<keyof LookbookSections, string> {
  validateLookbookSections(input);
  return serializeSections(input.sections);
}

export function validateInspirationAnalysisSections(input: {
  sections: InspirationAnalysisSections;
  folderImageFiles: Set<string>;
  filePath?: string;
}): void {
  const issues = [
    ...validateSection(input.sections.thesis, 'thesis', ['thesis'], input.filePath),
    ...validateSection(input.sections.palette, 'palette', ['palette'], input.filePath),
    ...validateSection(input.sections.toneMood, 'toneMood', ['toneMood'], input.filePath),
    ...validateSection(input.sections.composition, 'composition', ['composition'], input.filePath),
    ...validateSection(input.sections.lighting, 'lighting', ['lighting'], input.filePath),
    ...validateSection(input.sections.texture, 'texture', ['texture'], input.filePath),
    ...validateSection(input.sections.inspiredBy, 'inspiredBy', ['inspiredBy'], input.filePath),
  ];
  if (issues.length === 0) {
    issues.push(
      ...validateReferencedImageFiles(
        input.sections,
        input.folderImageFiles,
        input.filePath
      )
    );
  }
  throwVisualLanguageValidationIssues(issues, 'Visual Language JSON failed validation.');
}

export function validateInspirationAnalysisDocument(input: {
  document: InspirationAnalysisDocument;
  folderImageFiles: Set<string>;
  filePath?: string;
}): void {
  const shapeIssues = validateInspirationAnalysisDocumentShape({
    document: input.document,
    filePath: input.filePath,
  });
  if (shapeIssues.length > 0) {
    return;
  }
  const imageIssues = validateReferencedImageFiles(
    input.document.analysis,
    input.folderImageFiles,
    input.filePath,
    ['analysis']
  );
  throwVisualLanguageValidationIssues(
    imageIssues,
    'Visual Language JSON failed validation.'
  );
}

export function validateLookbookSections(input: {
  sections: LookbookSections;
  filePath?: string;
}): void {
  const issues = [
    ...validateSection(input.sections.thesis, 'thesis', ['thesis'], input.filePath),
    ...validateSection(input.sections.palette, 'palette', ['palette'], input.filePath),
    ...validateSection(input.sections.toneMood, 'toneMood', ['toneMood'], input.filePath),
    ...validateSection(input.sections.composition, 'composition', ['composition'], input.filePath),
    ...validateSection(input.sections.lighting, 'lighting', ['lighting'], input.filePath),
    ...validateSection(input.sections.texture, 'texture', ['texture'], input.filePath),
    ...validateSection(input.sections.camera, 'camera', ['camera'], input.filePath),
  ];
  if (issues.length === 0) {
    issues.push(...rejectLookbookImageFileReferences(input.sections, input.filePath));
  }
  throwVisualLanguageValidationIssues(issues, 'Visual Language JSON failed validation.');
}

export function parseStoredVisualLanguageSection<T>(input: {
  value: string;
  section: VisualLanguageStoredSectionKind;
  path: string[];
}): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.value);
  } catch {
    throwVisualLanguageValidationIssues(
      [
        createDiagnosticError(
          'PROJECT_DATA201',
          'Stored Visual Language section must be valid JSON.',
          { path: input.path },
          'Repair the stored Visual Language section JSON.'
        ),
      ],
      'Stored Visual Language JSON failed validation.'
    );
  }
  const issues = validateSection(parsed, input.section, input.path);
  throwVisualLanguageValidationIssues(
    issues,
    'Stored Visual Language JSON failed validation.'
  );
  return parsed as T;
}

export function assertLookbookSections(sections: string[]): LookbookSection[] {
  const allowed = new Set<LookbookSection>([
    'thesis',
    'palette',
    'tone_mood',
    'composition',
    'lighting',
    'texture',
    'camera',
  ]);
  const invalid = sections.filter((section) => !allowed.has(section as LookbookSection));
  if (invalid.length > 0) {
    throwVisualLanguageValidationIssues(
      invalid.map((section) =>
        createDiagnosticError(
          'PROJECT_DATA234',
          `Unsupported Lookbook section: ${section}.`,
          { path: ['sections'] },
          'Use thesis, palette, tone_mood, composition, lighting, texture, or camera.'
        )
      ),
      'Lookbook image sections failed validation.'
    );
  }
  return sections as LookbookSection[];
}

function validateSection(
  value: unknown,
  section: VisualLanguageStoredSectionKind,
  path: string[],
  filePath?: string
): DiagnosticIssue[] {
  const validator = ajv.getSchema(schemaIds[section]);
  if (!validator) {
    throw new Error(`Visual Language JSON schema was not registered for ${section}.`);
  }
  const valid = validator(value);
  return valid ? [] : mapAjvErrors(validator.errors ?? [], path, filePath);
}

function validateInspirationAnalysisDocumentShape(input: {
  document: unknown;
  filePath?: string;
}): DiagnosticIssue[] {
  const validator = ajv.getSchema(inspirationAnalysisDocumentSchema.$id);
  if (!validator) {
    throw new Error('Inspiration Analysis JSON schema was not registered.');
  }
  const valid = validator(input.document);
  const issues = valid ? [] : mapAjvErrors(validator.errors ?? [], [], input.filePath);
  throwVisualLanguageValidationIssues(
    issues,
    'Visual Language JSON failed validation.'
  );
  return issues;
}

function serializeSections<T extends Record<string, unknown>>(
  sections: T
): Record<keyof T, string> {
  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, JSON.stringify(value)])
  ) as Record<keyof T, string>;
}

function validateReferencedImageFiles(
  value: unknown,
  folderImageFiles: Set<string>,
  filePath?: string,
  pathPrefix: string[] = []
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  visitImageFiles(value, pathPrefix, (path, imageFile) => {
    if (!folderImageFiles.has(imageFile)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA233',
          `Inspiration analysis references an image that is not in the folder: ${imageFile}.`,
          { path, ...(filePath ? { filePath } : {}) },
          'Reference only image filenames that exist in the Inspiration folder.'
        )
      );
    }
  });
  return issues;
}

function rejectLookbookImageFileReferences(
  value: unknown,
  filePath?: string
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  visitImageFiles(value, [], (path) => {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA235',
        'Lookbook JSON must not store imageFiles.',
        { path, ...(filePath ? { filePath } : {}) },
        'Attach Lookbook images through lookbook_image_section placement rows.'
      )
    );
  });
  return issues;
}

function visitImageFiles(
  value: unknown,
  path: string[],
  visit: (path: string[], imageFile: string) => void
): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitImageFiles(item, [...path, String(index)], visit));
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.imageFiles)) {
    record.imageFiles.forEach((imageFile, index) => {
      if (typeof imageFile === 'string') {
        visit([...path, 'imageFiles', String(index)], imageFile);
      }
    });
  }
  for (const [key, child] of Object.entries(record)) {
    visitImageFiles(child, [...path, key], visit);
  }
}

function throwInvalidJson(filePath?: string): void {
  throwVisualLanguageValidationIssues(
    [
      createDiagnosticError(
        'PROJECT_DATA201',
        'Input must be a valid JSON object.',
        { path: [], ...(filePath ? { filePath } : {}) },
        'Provide a valid JSON object.'
      ),
    ],
    'Input must be a valid JSON object.'
  );
}

function throwVisualLanguageValidationIssues(
  issues: DiagnosticIssue[],
  message: string
): void {
  if (issues.length === 0) {
    return;
  }
  throwIfDiagnosticResultInvalid(buildDiagnosticResult(issues), {
    code: 'PROJECT_DATA230',
    message,
    suggestion: 'Fix the reported Visual Language issues and run the command again.',
  });
}

function mapAjvErrors(
  errors: ErrorObject[],
  pathPrefix: string[],
  filePath?: string
): DiagnosticIssue[] {
  return errors.map((error) => {
    const path = [...pathPrefix, ...pointerToPath(error.instancePath)];
    if (error.keyword === 'required') {
      const missing = String(error.params.missingProperty);
      return createDiagnosticError(
        'PROJECT_DATA206',
        `${missing} is required.`,
        { path: [...path, missing], ...(filePath ? { filePath } : {}) },
        `Add the required ${missing} field.`
      );
    }
    if (error.keyword === 'additionalProperties') {
      const extra = String(error.params.additionalProperty);
      return createDiagnosticError(
        'PROJECT_DATA232',
        `Unknown Visual Language field: ${extra}.`,
        { path: [...path, extra], ...(filePath ? { filePath } : {}) },
        'Remove the field or model it through the current Visual Language contract.'
      );
    }
    if (error.keyword === 'enum' || error.keyword === 'const') {
      return createDiagnosticError(
        'PROJECT_DATA207',
        `Unsupported value at ${formatPath(path)}.`,
        { path, ...(filePath ? { filePath } : {}) },
        'Use one of the documented values.'
      );
    }
    return createDiagnosticError(
      'PROJECT_DATA208',
      `Invalid value at ${formatPath(path)}.`,
      { path, ...(filePath ? { filePath } : {}) },
      'Use the documented type and format for this field.'
    );
  });
}

function pointerToPath(pointer: string): string[] {
  if (!pointer) {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function formatPath(path: string[]): string {
  return path.length ? path.join('.') : 'input';
}
