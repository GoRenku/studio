import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { SUPPORTED_PROJECT_LOCALES } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ResolvedProjectInformation } from './contracts.js';

const SUPPORTED_ASPECT_RATIOS = new Set([
  '1:1',
  '3:4',
  '4:3',
  '16:9',
  '9:16',
  '21:9',
]);

const SUPPORTED_LOCALE_TAGS = new Set<string>(
  SUPPORTED_PROJECT_LOCALES.map((locale) => locale.localeTag)
);

const PROJECT_STRING_ARRAY_FIELDS = [
  'secondaryGenres',
  'tones',
  'creativeBoundaries',
  'themes',
  'historicalBasis',
  'dramatizedElements',
  'researchSources',
  'assumptions',
  'openQuestions',
  'nextSteps',
] as const;

export function validateResolvedProjectInformation(
  information: ResolvedProjectInformation
): void {
  const issues: DiagnosticIssue[] = [];

  if (!information.title.trim()) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA050',
        'Project title is required.',
        { path: ['title'], context: 'project information update' },
        'Enter a project title before saving.'
      )
    );
  }

  if (
    information.aspectRatio !== undefined &&
    !SUPPORTED_ASPECT_RATIOS.has(information.aspectRatio)
  ) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA051',
        'Project aspect ratio is not supported.',
        { path: ['aspectRatio'], context: 'project information update' },
        'Choose one of 1:1, 3:4, 4:3, 16:9, 9:16, or 21:9.'
      )
    );
  }

  if (
    information.targetRuntimeMinutes !== undefined
    && (!Number.isInteger(information.targetRuntimeMinutes) || information.targetRuntimeMinutes < 0)
  ) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA050',
        'Project target runtime must be a non-negative integer.',
        { path: ['targetRuntimeMinutes'], context: 'project information update' },
        'Use a whole number of minutes greater than or equal to zero.',
      ),
    );
  }

  for (const field of PROJECT_STRING_ARRAY_FIELDS) {
    const values = information[field];
    if (values && (values.length === 0 || values.some((value) => !value.trim()))) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA050',
          `Project ${field} must contain non-empty values when present.`,
          { path: [field], context: 'project information update' },
          'Remove the empty list or provide one or more non-empty values.',
        ),
      );
    }
  }

  if (information.languages.length === 0) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA052',
        'At least one project language is required.',
        { path: ['languages'], context: 'project information update' },
        'Add at least one language.'
      )
    );
  }

  const seenLocaleTags = new Set<string>();
  let baseLanguageCount = 0;
  information.languages.forEach((language, index) => {
    const languagePath = ['languages', String(index)];
    if (!SUPPORTED_LOCALE_TAGS.has(language.localeTag)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA053',
          `Language ${language.localeTag} is not in the supported project language catalog.`,
          { path: [...languagePath, 'localeTag'], context: 'project information update' },
          'Choose a language from the Studio language dropdown.'
        )
      );
    }
    if (seenLocaleTags.has(language.localeTag)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA054',
          `Language ${language.localeTag} appears more than once.`,
          { path: [...languagePath, 'localeTag'], context: 'project information update' },
          'Keep only one row for each locale tag.'
        )
      );
    }
    seenLocaleTags.add(language.localeTag);
    if (language.isBase) {
      baseLanguageCount += 1;
    }
  });

  if (baseLanguageCount !== 1) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA055',
        'Exactly one project language must be marked as base.',
        { path: ['languages'], context: 'project information update' },
        'Choose one base language.'
      )
    );
  }

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throw new ProjectDataError(
      'PROJECT_DATA056',
      'Project information failed validation.',
      {
        issues: result.issues,
        suggestion: 'Fix the highlighted project information fields and save again.',
      }
    );
  }
}
