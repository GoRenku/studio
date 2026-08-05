import type { ProjectInformationPatch } from '../../client/index.js';
import type {
  ResolvedProjectInformation,
  ResolvedProjectLanguage,
} from './contracts.js';

export function resolveProjectInformationPatch(
  current: ResolvedProjectInformation,
  patch: ProjectInformationPatch
): ResolvedProjectInformation {
  const resolved: ResolvedProjectInformation = {
    title: patch.title ?? current.title,
    aspectRatio:
      patch.aspectRatio === null
        ? undefined
        : patch.aspectRatio ?? current.aspectRatio,
    logline: patchValue(current.logline, patch, 'logline'),
    synopsis: patchValue(current.synopsis, patch, 'synopsis'),
    premise: patchValue(current.premise, patch, 'premise'),
    intendedAudience: patchValue(current.intendedAudience, patch, 'intendedAudience'),
    format: patchValue(current.format, patch, 'format'),
    targetRuntimeMinutes: patchValue(current.targetRuntimeMinutes, patch, 'targetRuntimeMinutes'),
    primaryGenre: patchValue(current.primaryGenre, patch, 'primaryGenre'),
    secondaryGenres: patchValue(current.secondaryGenres, patch, 'secondaryGenres'),
    tones: patchValue(current.tones, patch, 'tones'),
    contentRatingIntent: patchValue(current.contentRatingIntent, patch, 'contentRatingIntent'),
    creativeBoundaries: patchValue(current.creativeBoundaries, patch, 'creativeBoundaries'),
    centralConflict: patchValue(current.centralConflict, patch, 'centralConflict'),
    dramaticQuestion: patchValue(current.dramaticQuestion, patch, 'dramaticQuestion'),
    themes: patchValue(current.themes, patch, 'themes'),
    historicalBasis: patchValue(current.historicalBasis, patch, 'historicalBasis'),
    dramatizedElements: patchValue(current.dramatizedElements, patch, 'dramatizedElements'),
    screenplayDraftStatus: patchValue(current.screenplayDraftStatus, patch, 'screenplayDraftStatus'),
    researchSources: patchValue(current.researchSources, patch, 'researchSources'),
    assumptions: patchValue(current.assumptions, patch, 'assumptions'),
    openQuestions: patchValue(current.openQuestions, patch, 'openQuestions'),
    nextSteps: patchValue(current.nextSteps, patch, 'nextSteps'),
    languages: current.languages.map((language) => ({ ...language })),
  };

  for (const operation of patch.languages ?? []) {
    if (operation.operation === 'add') {
      resolved.languages.push({
        localeTag: operation.localeTag,
        displayName: operation.displayName,
        isBase: operation.isBase ?? false,
        supportsAudio: operation.supportsAudio ?? true,
        supportsSubtitles: operation.supportsSubtitles ?? true,
      });
      if (operation.isBase) {
        setBaseLanguage(resolved.languages, operation.localeTag);
      }
    }
    if (operation.operation === 'update') {
      const language = resolved.languages.find(
        (entry) => entry.localeTag === operation.localeTag
      );
      if (!language) {
        resolved.languages.push({
          localeTag: operation.localeTag,
          displayName: operation.displayName ?? undefined,
          isBase: operation.isBase ?? false,
          supportsAudio: operation.supportsAudio ?? true,
          supportsSubtitles: operation.supportsSubtitles ?? true,
        });
      } else {
        if ('displayName' in operation) {
          language.displayName = operation.displayName ?? undefined;
        }
        if (operation.supportsAudio !== undefined) {
          language.supportsAudio = operation.supportsAudio;
        }
        if (operation.supportsSubtitles !== undefined) {
          language.supportsSubtitles = operation.supportsSubtitles;
        }
        if (operation.isBase !== undefined) {
          language.isBase = operation.isBase;
        }
      }
      if (operation.isBase) {
        setBaseLanguage(resolved.languages, operation.localeTag);
      }
    }
    if (operation.operation === 'remove') {
      resolved.languages = resolved.languages.filter(
        (language) => language.localeTag !== operation.localeTag
      );
    }
    if (operation.operation === 'setBase') {
      setBaseLanguage(resolved.languages, operation.localeTag);
    }
  }

  return resolved;
}

function setBaseLanguage(
  languages: ResolvedProjectLanguage[],
  localeTag: string
): void {
  for (const language of languages) {
    language.isBase = language.localeTag === localeTag;
  }
}

function patchValue<
  TKey extends keyof ProjectInformationPatch & keyof ResolvedProjectInformation,
>(
  current: ResolvedProjectInformation[TKey],
  patch: ProjectInformationPatch,
  key: TKey,
): ResolvedProjectInformation[TKey] {
  if (!(key in patch)) {
    return current;
  }
  return (patch[key] === null ? undefined : patch[key]) as ResolvedProjectInformation[TKey];
}
